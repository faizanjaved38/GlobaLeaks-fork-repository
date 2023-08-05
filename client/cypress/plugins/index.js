const istanbul = require('istanbul-lib-coverage');

module.exports = (on, config) => {
  on('task', {
    // This is the proper way to define the 'task' handler as an object
    'codeCoverage'(coverage) {
      if (!config.env.coverage) {
        config.env.coverage = {};
      }
      config.env.coverage = istanbul.createCoverageMap(coverage);
      return null;
    },
  });

  return config;
};
