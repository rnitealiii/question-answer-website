/* Hindi language pack for GoTranscript Text Checker.
 * To add another language, copy this file - see lang-en.js for instructions. */
(function () {
  'use strict';
  GoTranscriptChecker.registerLanguage({
    code: 'hi',
    name: 'Hindi',
    whisper: 'hindi',
    numWords: ['शून्य','एक','दो','तीन','चार','पाँच','छह','सात','आठ','नौ'],
    slang: {},
    affirm: {},
    fillerWords: [],
    fillerPhrases: [],
    checks: {
      acronyms: false,
      quotes: false,
      caps: false,
      ampm: false,
      oclock: false,
      mmhmm: false,
      devanagari: true,    // English words written in Devanagari script
      spelloutNumbers: true
    }
  });
})();
