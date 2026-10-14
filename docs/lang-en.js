/* English language pack for GoTranscript Text Checker.
 *
 * ADDING A NEW LANGUAGE (takes 2 minutes):
 *   1. Copy this file to lang-<code>.js (e.g. lang-ur.js)
 *   2. Change `code`, `name`, `whisper`, translate the word lists,
 *      and set the `checks` flags for that language.
 *   3. Add <script src="lang-<code>.js"></script> AFTER checker.js
 *      in checker.html and audio-compare.html. Done - no other change needed.
 */
(function () {
  'use strict';
  GoTranscriptChecker.registerLanguage({
    code: 'en',
    name: 'English',
    whisper: 'english',          // language name for the Whisper AI model
    numWords: ['zero','one','two','three','four','five','six','seven','eight','nine'],
    slang: {gonna:'going to', wanna:'want to', gotta:'got to', gotcha:'got you',
            gimme:'give me', dunno:"don't know", kinda:'kind of', betcha:'bet you',
            "'cause":'because', "'cause":'because'},
    affirm: {yeah:'yes', yep:'yes', yap:'yes', yup:'yes', 'mm-hmm':'yes', mmhmm:'yes',
             alright:'all right'},
    fillerWords: ['um','uh','er','hmm'],
    fillerPhrases: ['you know','i mean','sort of','kind of'],
    checks: {
      acronyms: true,      // USA not U.S.A.
      quotes: true,        // ," not ",
      caps: true,          // sentence capitalization
      ampm: true,          // 2:45 PM
      oclock: true,        // eleven o'clock
      mmhmm: true,         // only Mm-hmm/Mm/Mm-mm/Uh-huh/Uh-uh
      devanagari: false,   // N/A for English
      spelloutNumbers: true
    }
  });
})();
