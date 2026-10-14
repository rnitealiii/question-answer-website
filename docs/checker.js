/* GoTranscript Text Checker - modular rule engine (client-side, no server).
 *
 * Language packs are separate files (lang-en.js, lang-hi.js, ...) that call
 * GoTranscriptChecker.registerLanguage({...}). Adding a new language = adding
 * one file. See lang-en.js for instructions.
 *
 * API:
 *   GoTranscriptChecker.registerLanguage(pack)
 *   GoTranscriptChecker.languages() -> [{code, name}]
 *   GoTranscriptChecker.getLanguage(code) -> pack
 *   GoTranscriptChecker.check(text, {lang, verbatim}) -> {score, errorCount, warningCount, issues}
 *   GoTranscriptChecker.normalizeForDiff(text) -> [words]
 *   GoTranscriptChecker.diffWords(userWords, aiWords) -> [{t:'eq'|'del'|'ins', w}]
 */
(function (global) {
  'use strict';

  var LANGS = {};

  var NOUN_NUM = {grade:1, section:1, chapter:1, article:1, part:1, volume:1, page:1, paragraph:1, no:1};
  var MEASURE = {degrees:1, degree:1, feet:1, foot:1, centimeters:1, centimeter:1, inches:1, inch:1,
                 pounds:1, pound:1, kilos:1, kilo:1, kilograms:1, meters:1, meter:1, seconds:1,
                 minutes:1, hours:1, dollars:1, bucks:1, quid:1};
  var KNOWN_TAGS = {laughs:1, laughter:1, chuckles:1, giggles:1, sighs:1, coughs:1, crosstalk:1,
                    silence:1, applause:1, music:1, 'background noise':1, 'sound cut':1};

  function escRe(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function registerLanguage(pack){
    if (!pack || !pack.code) throw new Error('Language pack needs a code');
    LANGS[pack.code] = pack;
  }

  function languages(){
    return Object.keys(LANGS).map(function (k){ return {code: k, name: LANGS[k].name}; });
  }

  function getLanguage(code){ return LANGS[code] || null; }

  function lineOf(text, idx){
    return text.slice(0, idx).split('\n').length;
  }

  function isLabelLine(ln){
    return /^\s*\*{0,2}\s*(Speaker\s+\d+|\?[A-Za-z][\w ]*|[A-Z][A-Za-z.'’\- ]{0,30}?)\s*\*{0,2}\s*:/.test(ln);
  }

  function stripLabel(line){
    return line.replace(/^\s*\*{0,2}\s*(Speaker\s+\d+|\?[A-Za-z][\w ]*|[A-Z][A-Za-z.'’\- ]{0,30}?)\s*\*{0,2}\s*:\s*/, '');
  }

  function check(text, opts){
    opts = opts || {};
    var P = LANGS[opts.lang] || LANGS.en;
    if (!P) throw new Error('No language packs registered');
    var lang = P.code;
    var verb = opts.verbatim === 'full' ? 'full' : 'clean';
    var C = P.checks || {};
    var lines = text.split('\n');
    var issues = [];

    function add(line, sev, rule, msg, fix){
      issues.push({line: line, sev: sev, rule: rule, msg: msg, fix: fix || ''});
    }

    lines.forEach(function (raw, i){
      var ln = i + 1;
      var line = raw;

      // R1: no exclamation marks
      if (line.indexOf('!') !== -1)
        add(ln, 'error', 'No exclamation marks', 'Exclamation marks are never used.', 'Remove "!" and end the sentence with a period.');

      // R2: no [sic]
      if (/\[sic\]/i.test(line))
        add(ln, 'error', 'No [sic] tag', 'The [sic] tag must not be used.', 'Remove [sic]; transcribe the word as spoken.');

      // R3: brackets, never parentheses
      if (/[()]/.test(line))
        add(ln, 'error', 'Brackets only', 'Never use ( ) instead of [ ].', 'Replace ( ) with [ ].');

      // R4: no Tab key
      if (/\t/.test(line))
        add(ln, 'error', 'No Tab key', 'Never use the Tab button; use one space.', 'Replace tabs with a single space.');

      // R5: double spaces
      if (/  /.test(line))
        add(ln, 'warning', 'Single spacing', 'Use only one space between words.', 'Remove extra spaces.');

      // R6: trailing whitespace
      if (/[ \t]+$/.test(line) && line.trim() !== '')
        add(ln, 'warning', 'Trailing space', 'Line ends with extra space.', 'Remove trailing spaces.');

      // R7: speaker label must end with colon
      if (/^\s*\*{0,2}\s*Speaker\s+\d+\b(?!\s*:)/i.test(line))
        add(ln, 'error', 'Speaker label format', 'Speaker label must be followed by a colon.', 'Write "Speaker 1:" (colon + one space).');

      // R8: malformed timestamps - must be [HH:MM:SS]
      var tm2 = /\[(\d{1,3}:\d{2}(?::\d{2})?)\]/g, tmm;
      while ((tmm = tm2.exec(line)) !== null){
        if (!/^\d+:\d{2}:\d{2}$/.test(tmm[1]))
          add(ln, 'error', 'Timestamp format', 'Timestamp must be [HH:MM:SS].', 'Write the full timestamp, e.g. [00:04:24].');
      }

      // R9: timestamp in parentheses
      if (/\(\d+:\d{2}:\d{2}\)/.test(line))
        add(ln, 'error', 'Timestamp brackets', 'Timestamps use [ ], never ( ).', 'Replace ( ) with [ ].');

      // R10: bracket tags
      var tagRe = /\[([^\]\[]+)\]/g, m;
      while ((m = tagRe.exec(line)) !== null){
        var inner = m[1].trim();
        if (/^\d+:\d{2}:\d{2}$/.test(inner)) continue;
        var low = inner.toLowerCase();
        if (/^(in)?audible|unintelligible/i.test(inner)){
          if (!/^(inaudible|unintelligible)\s+\d+:\d{2}:\d{2}$/i.test(inner))
            add(ln, 'error', 'Inaudible marking', 'Only [inaudible 00:00:00] and [unintelligible 00:00:00] are allowed. Never invent your own marking.', 'Use [inaudible 00:00:00] or [unintelligible 00:00:00].');
          continue;
        }
        var hasTs = /\d+:\d{2}:\d{2}/.test(inner);
        var core = inner.replace(/\s*\d+:\d{2}:\d{2}\s*/, '').trim().toLowerCase();
        var coreWords = core ? core.split(/\s+/) : [];
        if (inner !== low)
          add(ln, 'error', 'Sound notes lowercase', 'Sound notes are always written in lower case.', 'Write the tag in lower case: [' + low + '].');
        if (!hasTs && coreWords.length > 2)
          add(ln, 'error', 'Sound notes: two words max', 'Sound notes must not exceed two words.', 'Shorten the note to two words or fewer.');
        if (!hasTs && coreWords.length <= 2 && coreWords.length > 0 &&
            !(core in KNOWN_TAGS) && !/pause/.test(core) && !/language/.test(core))
          add(ln, 'warning', 'Unusual sound note', 'This sound note is not a standard one. Keep notes concise, present tense, max two words.', 'Use a standard note like [laughs], [crosstalk], [silence], [background noise].');
      }

      // R11-R14: clean-verbatim word rules from the language pack
      if (verb === 'clean'){
        Object.keys(P.slang || {}).forEach(function (w){
          var re = new RegExp('\\b' + escRe(w) + '\\b', 'i');
          if (re.test(line))
            add(ln, 'error', 'No slang (clean verbatim)', 'Slang "' + w + '" must be written out.', 'Write "' + P.slang[w] + '".');
        });
        Object.keys(P.affirm || {}).forEach(function (w){
          var re = new RegExp('\\b' + escRe(w) + '\\b', 'i');
          if (re.test(line))
            add(ln, 'error', 'Word normalization', '"' + w + '" must be written as "' + P.affirm[w] + '".', 'Write "' + P.affirm[w] + '".');
        });
        if (lang === 'en' && /\bO[Kk]\b/.test(line))
          add(ln, 'error', 'Word normalization', '"OK"/"Ok" must always be spelled "Okay".', 'Write "Okay".');
        (P.fillerWords || []).forEach(function (w){
          if (new RegExp('\\b' + escRe(w) + '\\b', 'i').test(line))
            add(ln, 'warning', 'Filler word', 'Filler "' + w + '" is usually removed in clean verbatim.', 'Remove it if it does not change the meaning.');
        });
        (P.fillerPhrases || []).forEach(function (p){
          if (new RegExp('\\b' + escRe(p) + '\\b', 'i').test(line))
            add(ln, 'warning', 'Filler phrase', 'Filler "' + p + '" is usually removed in clean verbatim.', 'Remove it if the sentence stays clear without it.');
        });
        if (lang === 'en' && /^\s*\*{0,2}\s*(And|But|So)\b/.test(line) && !isLabelLine(line))
          add(ln, 'warning', 'Conjunction start', 'Avoid starting sentences with conjunctions in clean verbatim.', 'Expand the sentence instead of starting with And/But/So.');
      }

      // R15: numbers spelled out (single digits)
      if (C.spelloutNumbers){
        (function (){
          var words = P.numWords || [];
          var re = /(?<![$£€₹\d:.])\b([0-9])\b(?![\d.%a-zA-Z:’'])/g, mm;
          while ((mm = re.exec(line)) !== null){
            var before = line.slice(0, mm.index);
            var bw = (before.match(/([A-Za-z]+)\.?\s*$/) || [])[1];
            if (bw && NOUN_NUM[bw.toLowerCase()]) continue;
            var afterW = (line.slice(mm.index + mm[0].length).match(/^\s*([A-Za-z]+)/) || [])[1];
            if (afterW && MEASURE[afterW.toLowerCase()]) continue;
            var d = parseInt(mm[1], 10);
            var word = words[d] || String(d);
            add(ln, 'error', 'Spell out single digits',
                'Single-digit numbers are spelled out (' + word + ').',
                'Write "' + word + '" instead of "' + mm[1] + '".');
          }
        })();
      }

      // R16: acronyms without periods
      if (C.acronyms){
        var are = /\b(?:[A-Z]\.){2,}/g, am;
        while ((am = are.exec(line)) !== null)
          add(ln, 'error', 'Acronyms', 'Abbreviations must not contain periods: USA, PhD.', 'Remove the periods: "' + am[0].replace(/\./g, '') + '".');
      }

      // R17: quotation punctuation
      if (C.quotes){
        if (/"\,/.test(line))
          add(ln, 'error', 'Quotation punctuation', 'Commas always go inside the quotation marks.', 'Write ," instead of ",.');
        if (/"\.(?!\.)/.test(line))
          add(ln, 'error', 'Quotation punctuation', 'Periods always go inside the quotation marks.', 'Write ." instead of ".');
        if (/\b(said|replied|asked|answered|shouted|whispered)\s*:\s*"/i.test(line))
          add(ln, 'warning', 'Quotation introduction', 'Quotations are introduced by a comma, not a colon.', 'Write: said, "…"');
      }

      // R18: et cetera
      if (/\betc\./i.test(line))
        add(ln, 'warning', 'et cetera', 'Do not shorten; write the full expression.', 'Write "et cetera".');

      // R19: o'clock + AM/PM
      if (C.oclock){
        var oc = line.match(/\b(\d+)\s+o['’]clock/i);
        if (oc) add(ln, 'error', "o'clock", 'With o\'clock, spell out the number.', 'Write e.g. "eleven o\'clock".');
      }
      if (C.ampm){
        var ap = line.match(/\b\d{1,2}(?::\d{2})?\s?(am|pm)\b/);
        if (ap) add(ln, 'error', 'AM/PM', 'AM and PM are always capitalized.', 'Write "' + ap[0].replace(/(am|pm)/, function (x){ return x.toUpperCase(); }) + '".');
      }

      // R20: mm-hmm forms
      if (C.mmhmm && /\b(mmhm|uhhuh)\b/i.test(line))
        add(ln, 'error', 'Affirmative sounds', 'Only Mm-hmm, Mm, Mm-mm, Uh-huh, Uh-uh are allowed.', 'Use "Mm-hmm" or "Uh-huh".');

      // R21: every sentence ends with punctuation
      (function (){
        var t = line.trim();
        if (!t || isLabelLine(t)) return;
        if (/^\[.*\]$/.test(t)) return;
        var endOk = /[.?।:;\]"'’—-]$/.test(t) || /--$/.test(t);
        if (!endOk)
          add(ln, 'warning', 'Sentence punctuation', 'Every sentence should end with a punctuation mark.', 'End the sentence with a period (or -- if incomplete).');
      })();

      // R22: Devanagari script check
      if (C.devanagari){
        var checkPart = isLabelLine(line) ? stripLabel(line) : line;
        var stripped = checkPart.replace(/\[[^\]]*\]/g, ' ').replace(/https?:\S+/g, ' ');
        var lat = stripped.match(/[A-Za-z]{2,}/g);
        if (lat && lat.length){
          var ex = lat.slice(0, 3).join(', ');
          add(ln, 'warning', 'Devanagari script', 'English words in transcripts are written in Devanagari script.', 'Write "' + ex + '" in Devanagari, e.g. transliterate it.');
        }
      }
    });

    // R23: sentence capitalization
    if (C.caps){
      var capRe = /([.!?]\s+)([a-z])/g, cm;
      while ((cm = capRe.exec(text)) !== null)
        add(lineOf(text, cm.index + cm[1].length), 'warning', 'Capitalization',
            'The beginning of every sentence should be capitalized.', 'Capitalize "' + cm[2] + '".');
    }

    // R24: timestamp chronology
    (function (){
      var tsRe = /\[(\d+):([0-5]\d):([0-5]\d)\]/g, tm, prev = -1, prevStr = '';
      while ((tm = tsRe.exec(text)) !== null){
        var secs = (+tm[1]) * 3600 + (+tm[2]) * 60 + (+tm[3]);
        if (secs < prev)
          add(lineOf(text, tm.index), 'error', 'Timestamp order',
              'Timestamps must run forward in time (' + prevStr + ' → ' + tm[0] + ').', 'Fix the timestamp order.');
        if (secs > prev){ prev = secs; prevStr = tm[0]; }
      }
    })();

    var errors = issues.filter(function (x){ return x.sev === 'error'; }).length;
    var warnings = issues.length - errors;
    var score = Math.max(0, 100 - errors * 3 - warnings);

    issues.sort(function (a, b){
      return (a.line - b.line) || (a.sev === 'error' ? -1 : 1);
    });

    return { score: score, errorCount: errors, warningCount: warnings, issues: issues };
  }

  /* Normalize transcript text for AI comparison: strip speaker labels,
   * timestamps and [tags], lowercase, drop punctuation, split into words. */
  function normalizeForDiff(text){
    return text
      .replace(/^\s*\*{0,2}\s*(Speaker\s+\d+|\?[A-Za-z][\w ]*|[A-Z][A-Za-z.'’\- ]{0,30}?)\s*\*{0,2}\s*:/gm, ' ')
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/\(\d+:\d{2}:\d{2}\)/g, ' ')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s']/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean);
  }

  /* Word-level diff (LCS). a = user's words, b = AI's words.
   * Returns ops: {t:'eq'} same | {t:'del'} in user only (extra) | {t:'ins'} in AI only (missed). */
  function diffWords(a, b){
    var n = a.length, m = b.length;
    if (n * m > 9000000) return { tooLong: true, ops: [] };
    var W = m + 1;
    var dp = new Uint32Array((n + 1) * W);
    var i, j;
    for (i = n - 1; i >= 0; i--){
      for (j = m - 1; j >= 0; j--){
        dp[i * W + j] = a[i] === b[j]
          ? dp[(i + 1) * W + j + 1] + 1
          : Math.max(dp[(i + 1) * W + j], dp[i * W + j + 1]);
      }
    }
    var ops = [], x = 0, y = 0;
    while (x < n && y < m){
      if (a[x] === b[y]){ ops.push({t:'eq', w:a[x]}); x++; y++; }
      else if (dp[(x + 1) * W + y] >= dp[x * W + y + 1]){ ops.push({t:'del', w:a[x]}); x++; }
      else { ops.push({t:'ins', w:b[y]}); y++; }
    }
    while (x < n){ ops.push({t:'del', w:a[x]}); x++; }
    while (y < m){ ops.push({t:'ins', w:b[y]}); y++; }
    return { tooLong: false, ops: ops };
  }

  global.GoTranscriptChecker = {
    check: check,
    registerLanguage: registerLanguage,
    languages: languages,
    getLanguage: getLanguage,
    normalizeForDiff: normalizeForDiff,
    diffWords: diffWords
  };
})(typeof window !== 'undefined' ? window : globalThis);
