'use strict';

let R = require('ramda');
let database = require('./database');

let isForeAnalysisGreater = R.converge(R.gt, [
  R.path(['regressor', 'source', 'foreAnalysis', 'average']),
  R.path(['regressor', 'source', 'backAnalysis', 'average'])
]);

let createRegression = (point) => {
  let source = point.regressor.source;

  return {
    key: 'regression',
    fields: { revisionId: source.revisionId },
    tags: R.omit(['time', 'value', 'revisionId'], source)
  };
};

let removePositives = R.filter(isForeAnalysisGreater);

let trackRegressions = (client, data) => {
  let regressions = R.map(createRegression, data);

  return client
    .writeMany(regressions)
    .then(() => data);
};

let removeTracked = R.pipe(
  R.filter(R.pipe(R.last, R.not)),
  R.map(R.head)
);

let whereRegression = R.pipe(
  R.omit(['time', 'value', 'name']),
  R.toPairs,
  R.map((pair) => `${R.head(pair)} = '${R.last(pair)}'`),
  R.join(' AND ')
);

let hasResults = R.pipe(
  R.prop('results'),
  R.head,
  R.has('series')
);

let isAlreadyTracked = (client, regression) => {
  let source = regression.regressor.source;

  return client
    .query(`SELECT * FROM regression WHERE ${whereRegression(source)}`)
    .then(hasResults);
};

let removePreviouslyTracked = (client, data) => {
  let tracked = R.partial(isAlreadyTracked, [client]);

  return Promise
    .all(R.map(tracked, data))
    .then(R.zip(data))
    .then(removeTracked);
};

let annotate = (client, item) => {
  return client
    .query(`SELECT * FROM annotation WHERE revisionId = '${item.revisionId}'`)
    .then(response => {
      let result = response.results[0].series[0];
      let titleIndex = R.indexOf('title', result.columns);
      let textIndex = R.indexOf('text', result.columns);
      let props = R.map(values => {
        return R.objOf(
          R.nth(titleIndex, values),
          R.nth(textIndex, values)
        );
      }, result.values);

      return R.mergeAll(R.concat([item], props));
    });
};

let mergeAnnotations = (client, data) => {
  return Promise.all(R.map(regression => {
    return Promise.all([
      annotate(client, regression.regressor.source),
      annotate(client, regression.previous.source)
    ])
    .then(annotations => {
      return {
        source: R.head(annotations),
        previous: R.last(annotations)
      };
    });
  }, data));
};

module.exports = (options, data) => {
  let client;

  return Promise
    .resolve(options)
    .then(database)
    .then(_client => client = _client)
    .then(() => data)
    .then(removePositives)
    .then(data => removePreviouslyTracked(client, data))
    .then(data => trackRegressions(client, data))
    .then(data => mergeAnnotations(client, data));
};