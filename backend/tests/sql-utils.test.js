// Unit tests for utils/sql.js (no database needed).

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { escapeLike } = require('../utils/sql');

describe('escapeLike()', () => {
  it('escapes the LIKE wildcards % and _ and the escape character !', () => {
    assert.equal(escapeLike('100%'), '100!%');
    assert.equal(escapeLike('a_b'), 'a!_b');
    assert.equal(escapeLike('wow!'), 'wow!!');
    assert.equal(escapeLike('%_!'), '!%!_!!');
  });

  it('leaves ordinary text, spaces, quotes, ampersands, backslashes and non-English letters unchanged', () => {
    for (const text of ['Midnight Monsoon', "it's", 'Chai & Chaos', 'a\\b', 'Dilli ', 'संगीत', 'Café']) {
      assert.equal(escapeLike(text), text);
    }
  });

  it('handles an empty string and non-string input safely', () => {
    assert.equal(escapeLike(''), '');
    assert.equal(escapeLike(42), '42');
  });
});
