'use strict';

let R = require('ramda');
let track = require('./lib');

module.exports = (cli) => {
  let command = cli
    .command('track')
    .description('Pipe in regression search results to track in an InfluxDB database')
    .action(function() {
      return Promise
        .all([
          cli.getOptions(this),
          cli.stdin()
        ])
        .then(R.apply(track))
        .then(cli.JSON)
        .catch(cli.exits);
    });

  cli.usesDatabase(command);

  return command;
};
