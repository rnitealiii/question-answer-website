/* GoTranscript Text Checker - strict rule engine (client-side, no server).
 * checkTranscript(text, {lang: 'en'|'hi', verbatim: 'clean'|'full'})
 * -> { score, errorCount, warningCount, issues: [{line, sev, rule, msg, fix}] }
 * Rules are derived from GoTranscript's official transcription guidelines.
 */
(function (global) {
  'use strict';

  var NUM_EN = ['zero','one','two','three','four','five','six','seven','eight','nine'];
  var NUM_HI = ['शून्य','एक','दो','तीन','चार','पाँच','छह','सात','आठ','नौ'];
  var SLANG = {gonna:'going to', wanna:'want to', gotta:'got to', gotcha:'got you',
               gimme:'give me', dunno:"don't know", kinda:'kind of', betcha:'bet you'};
  var CAUSE = {"'cause":'because', "'cause":'because'};
  var AFFIRM = {yeah:'yes', yep:'yes', yap:'yes', yup:'yes', 'mm-hmm':'yes', mmhmm:'yes', alright:'all right'};
  var FILLER_WORDS = ['um','uh','er','hmm'];
  var FILLER_PHRASES = ['you know','i mean','sort of','kind of'];
  var NOUN_NUM = {grade:1, section:1, chapter:1, article:1, part:1, volume:1, page:1, paragraph:1, no:1};
  var MEASURE = {degrees:1, degree:1, feet:1, foot:1, centimeters:1, centimeter:1, inches:1, inch:1,
                 pounds:1, pound:1, kilos:1, kilo:1, kilograms:1, meters:1, meter:1, seconds:1,
                 minutes:1, hours:1, dollars:1, bucks:1, quid:1};
  var KNOWN_TAGS = {laughs:1, laughter:1, chuckles:1, giggles:1, sighs:1, coughs:1, crosstalk:1,
                    silence:1, applause:1, music:1, 'background noise':1, 'sound cut':1};

  function escRe(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function lineOf(text, idx){
    return text.slice(0, idx).split('\n').length;
  }

  function checkTranscript(text, opts){
    opts = opts || {};
    var lang = opts.lang === 'hi' ? 'hi' : 'en';
    var verb = opts.verbatim === 'full' ? 'full' : 'clean';
    var lines = text.split('\n');
    var issues = [];

    function add(line, sev, rule, msg, fix){
      issues.push({line: line, sev: sev, rule: rule, msg: msg, fix: fix || ''});
    }

    var isLabelLine = function (ln){
      return /^\s*\*{0,2}\s*(Speaker\s+\d+|\?[A-Za-z][\w ]*|[A-Z][A-Za-z.'’\- ]{0,30}?)\s*\*{0,2}\s*:/.test(ln);
    };

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
          add(ln, 'error', 'Timestamp format', 'Timestamp must be [HH:MM:SS].', 'Write the full timestamp, e.g. [' + tmm[1] + ':00] or [00:' + tmm[1] + '].');
      }

      // R9: timestamp in parentheses
      if (/\(\d+:\d{2}:\d{2}\)/.test(line))
        add(ln, 'error', 'Timestamp brackets', 'Timestamps use [ ], never ( ).', 'Replace ( ) with [ ].');

      // R10: bracket tags
      var tagRe = /\[([^\]\[]+)\]/g, m;
      while ((m = tagRe.exec(line)) !== null){
        var inner = m[1].trim();
        if (/^\d+:\d{2}:\d{2}$/.test(inner)) continue; // plain timestamp
        var low = inner.toLowerCase();
        if (/^(in)?audible|unintelligible/i.test(inner)){
          if (!/^(inaudible|unintelligible)\s+\d+:\d{2}:\d{2}$/i.test(inner))
            add(ln, 'error', 'Inaudible marking', 'Only [inaudible 00:00:00] and [unintelligible 00:00:00] are allowed. Never invent your own marking.', 'Use [inaudible 00:00:00] or [unintelligible 00:00:00].');
          continue;
        }
        var words = low.split(/\s+/);
        var hasTs = /\d+:\d{2}:\d{2}/.test(inner);
        var core = inner.replace(/\s*\d+:\d{2}:\d{2}\s*/, '').trim().toLowerCase();
        var coreWords = core ? core.split(/\s+/) : [];
        if (inner !== low)
          add(ln, 'error', 'Sound notes lowercase', 'Sound notes are always written in lower case.', 'Write the tag in lower case: [' + low + '].');
        if (!hasTs && coreWords.length > 2)
          add(ln, 'error', 'Sound notes: two words max', 'Sound notes must not exceed two words.', 'Shorten the note to two words or fewer.');
        if (!hasTs && coreWords.length <= 2 && !(core in KNOWN_TAGS) && !/pause/.test(core) && !/language/.test(core))
          add(ln, 'warning', 'Unusual sound note', 'This sound note is not a standard one. Keep notes concise, present tense, max two words.', 'Use a standard note like [laughs], [crosstalk], [silence], [background noise].');
      }

      // R11: slang (clean verbatim, English)
      if (lang === 'en' && verb === 'clean'){
        Object.keys(SLANG).forEach(function (w){
          var re = new RegExp('\\b' + escRe(w) + '\\b', 'i');
          if (re.test(line))
            add(ln, 'error', 'No slang (clean verbatim)', 'Slang "' + w + '" must be written out.', 'Write "' + SLANG[w] + '".');
        });
        Object.keys(CAUSE).forEach(function (w){
          var re = new RegExp(escRe(w) + '\\b', 'i');
          if (re.test(line))
            add(ln, 'error', 'No slang (clean verbatim)', "'" + w + "' must be written out.", 'Write "because".');
        });
        // R12: yeah/yep/alright/OK
        Object.keys(AFFIRM).forEach(function (w){
          var re = new RegExp('\\b' + escRe(w) + '\\b', 'i');
          if (re.test(line))
            add(ln, 'error', 'Word normalization', '"' + w + '" must be written as "' + AFFIRM[w] + '".', 'Write "' + AFFIRM[w] + '".');
        });
        if (/\bO[Kk]\b/.test(line))
          add(ln, 'error', 'Word normalization', '"OK"/"Ok" must always be spelled "Okay".', 'Write "Okay".');
        // R13: filler words (warning - context dependent)
        FILLER_WORDS.forEach(function (w){
          if (new RegExp('\\b' + w + '\\b', 'i').test(line))
            add(ln, 'warning', 'Filler word', 'Filler "' + w + '" is usually removed in clean verbatim.', 'Remove it if it does not change the meaning.');
        });
        FILLER_PHRASES.forEach(function (p){
          if (new RegExp('\\b' + escRe(p) + '\\b', 'i').test(line))
            add(ln, 'warning', 'Filler phrase', 'Filler "' + p + '" is usually removed in clean verbatim.', 'Remove it if the sentence stays clear without it.');
        });
        // R14: sentence starting with conjunction
        if (/^\s*\*{0,2}\s*(And|But|So)\b/.test(line) && !isLabelLine(line))
          add(ln, 'warning', 'Conjunction start', 'Avoid starting sentences with conjunctions in clean verbatim.', 'Expand the sentence instead of starting with And/But/So.');
      }

      // R15: numbers spelled out (single digits)
      (function (){
        var words = lang === 'hi' ? NUM_HI : NUM_EN;
        var re = /(?<![$£€₹\d:.])\b([0-9])\b(?![\d.%a-zA-Z:’'])/g, mm;
        while ((mm = re.exec(line)) !== null){
          var before = line.slice(0, mm.index);
          var bw = (before.match(/([A-Za-z]+)\.?\s*$/) || [])[1];
          if (bw && NOUN_NUM[bw.toLowerCase()]) continue;       // Grade 8, Chapter 1...
          var afterW = (line.slice(mm.index + mm[0].length).match(/^\s*([A-Za-z]+)/) || [])[1];
          if (afterW && MEASURE[afterW.toLowerCase()]) continue; // 3 degrees, 7 pounds...
          var d = parseInt(mm[1], 10);
          add(ln, 'error', 'Spell out single digits',
              'Single-digit numbers are spelled out (' + words[d] + ').',
              'Write "' + words[d] + '" instead of "' + mm[1] + '".');
        }
      })();

      // R16: acronyms without periods (English)
      if (lang === 'en'){
        var am;
        var are = /\b(?:[A-Z]\.){2,}/g;
        while ((am = are.exec(line)) !== null)
          add(ln, 'error', 'Acronyms', 'Abbreviations must not contain periods: USA, PhD.', 'Remove the periods: "' + am[0].replace(/\./g, '') + '".');
      }

      // R17: commas/periods inside quotation marks (English)
      if (lang === 'en'){
        if (/"\,/.test(line))
          add(ln, 'error', 'Quotation punctuation', 'Commas always go inside the quotation marks.', 'Write ," instead of ",.');
        if (/"\.(?!\.)/.test(line))
          add(ln, 'error', 'Quotation punctuation', 'Periods always go inside the quotation marks.', 'Write ." instead of ".');
        var qi = /\b(said|replied|asked|answered|shouted|whispered)\s*:\s*"/i;
        if (qi.test(line))
          add(ln, 'warning', 'Quotation introduction', 'Quotations are introduced by a comma, not a colon.', 'Write: said, "…"');
      }

      // R18: et cetera
      if (/\betc\./i.test(line))
        add(ln, 'warning', 'et cetera', 'Do not shorten; write the full expression.', 'Write "et cetera".');

      // R19: o'clock numbers spelled out (English)
      if (lang === 'en'){
        var oc = line.match(/\b(\d+)\s+o['’]clock/i);
        if (oc) add(ln, 'error', "o'clock", 'With o\'clock, spell out the number.', 'Write e.g. "eleven o\'clock".');
        var ap = line.match(/\b\d{1,2}(?::\d{2})?\s?(am|pm)\b/);
        if (ap) add(ln, 'error', 'AM/PM', 'AM and PM are always capitalized.', 'Write "' + ap[0].replace(/(am|pm)/, function(x){return x.toUpperCase();}) + '".');
      }

      // R20: mm-hmm forms (English)
      if (lang === 'en' && /\b(mmhm|uhhuh)\b/i.test(line))
        add(ln, 'error', 'Affirmative sounds', 'Only Mm-hmm, Mm, Mm-mm, Uh-huh, Uh-uh are allowed.', 'Use "Mm-hmm" or "Uh-huh".');

      // R21: every sentence ends with punctuation
      (function (){
        var t = line.trim();
        if (!t || isLabelLine(t)) return;
        if (/^\[.*\]$/.test(t)) return; // tag-only line
        var endOk = /[.?।:;\]"'’—-]$/.test(t) || /--$/.test(t) || /\]$/.test(t);
        if (!endOk)
          add(ln, 'warning', 'Sentence punctuation', 'Every sentence should end with a punctuation mark.', 'End the sentence with a period (or -- if incomplete).');
      })();

      // R22: Hindi - English words in Devanagari
      if (lang === 'hi'){
        var checkPart = line;
        if (isLabelLine(line)) checkPart = line.replace(/^\s*\*{0,2}\s*(Speaker\s+\d+|\?[A-Za-z][\w ]*|[A-Z][A-Za-z.'’\- ]{0,30}?)\s*\*{0,2}\s*:\s*/, '');
        var stripped = checkPart.replace(/\[[^\]]*\]/g, ' ').replace(/https?:\S+/g, ' ');
        var lat = stripped.match(/[A-Za-z]{2,}/g);
        if (lat && lat.length){
          var ex = lat.slice(0, 3).join(', ');
          add(ln, 'warning', 'Devanagari script', 'English words in Hindi transcripts are written in Devanagari script.', 'Write "' + ex + '" in Devanagari, e.g. transliterate it.');
        }
      }
    });

    // R23: sentence capitalization (English, whole text)
    if (lang === 'en'){
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

  global.GoTranscriptChecker = { check: checkTranscript };
})(typeof window !== 'undefined' ? window : globalThis);
