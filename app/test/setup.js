// eslint-disable-next-line import/no-extraneous-dependencies
require('@babel/register')({
  ignore: [(name) => name.includes('node_modules') && !name.includes('obs-store')],
})

require('./helper')

window.fetch =
  window.fetch ||
  function fetch() {
    return Promise.resolve()
  }
global.indexedDB = {}
global.fetch =
  global.fetch ||
  function fetch() {
    return Promise.resolve()
  }
