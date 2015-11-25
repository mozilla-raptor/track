'use strict';

let influent = require('influent');
let R = require('ramda');

/**
 * Create a database client
 * @param {Object} options
 * @returns {Promise}
 */
module.exports = R.memoize((options) => {
  let server = R.pick(['protocol', 'host', 'port'], options);
  let filteredOptions = R.pick(['database', 'username', 'password'], options);
  let settings = R.merge({
    server,
    precision: 'n'
  }, filteredOptions);

  return influent.createClient(settings);
});
