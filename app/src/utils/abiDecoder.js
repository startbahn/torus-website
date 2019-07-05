import Web3 from 'web3'
const BN = require('bn.js')
let web3 = new Web3()
let sha3 = web3.utils.sha3

const state = {
  savedABIs: [],
  methodIDs: {}
}

function _getABIs() {
  return state.savedABIs
}

function _addABI(abiArray) {
  if (Array.isArray(abiArray)) {
    // Iterate new abi to generate method id's
    abiArray.map(function(abi) {
      if (abi.name) {
        const signature = sha3(
          abi.name +
            '(' +
            abi.inputs
              .map(function(input) {
                return input.type
              })
              .join(',') +
            ')'
        )
        if (abi.type === 'event') {
          state.methodIDs[signature.slice(2)] = abi
        } else {
          state.methodIDs[signature.slice(2, 10)] = abi
        }
      }
    })

    state.savedABIs = state.savedABIs.concat(abiArray)
  } else {
    throw new Error('Expected ABI array, got ' + typeof abiArray)
  }
}

function _removeABI(abiArray) {
  if (Array.isArray(abiArray)) {
    // Iterate new abi to generate method id's
    abiArray.map(function(abi) {
      if (abi.name) {
        const signature = sha3(
          abi.name +
            '(' +
            abi.inputs
              .map(function(input) {
                return input.type
              })
              .join(',') +
            ')'
        )
        if (abi.type === 'event') {
          if (state.methodIDs[signature.slice(2)]) {
            delete state.methodIDs[signature.slice(2)]
          }
        } else {
          if (state.methodIDs[signature.slice(2, 10)]) {
            delete state.methodIDs[signature.slice(2, 10)]
          }
        }
      }
    })
  } else {
    throw new Error('Expected ABI array, got ' + typeof abiArray)
  }
}

function _getMethodIDs() {
  return state.methodIDs
}

function _decodeMethod(data) {
  const methodID = data.slice(2, 10)
  const abiItem = state.methodIDs[methodID]
  if (abiItem) {
    const params = abiItem.inputs.map(function(item) {
      return item.type
    })
    let decoded = web3.eth.abi.decodeParameters(params, data.slice(10))

    let retData = {
      name: abiItem.name,
      params: []
    }

    for (let i = 0; i < decoded.__length__; i++) {
      let param = decoded[i]
      let parsedParam = param
      const isUint = abiItem.inputs[i].type.indexOf('uint') === 0
      const isInt = abiItem.inputs[i].type.indexOf('int') === 0
      const isAddress = abiItem.inputs[i].type.indexOf('address') === 0

      if (isUint || isInt) {
        const isArray = Array.isArray(param)

        if (isArray) {
          parsedParam = param.map(val => new BN(val).toString())
        } else {
          parsedParam = new BN(param).toString()
        }
      }

      // Addresses returned by web3 are randomly cased so we need to standardize and lowercase all
      if (isAddress) {
        const isArray = Array.isArray(param)

        if (isArray) {
          parsedParam = param.map(_ => _.toLowerCase())
        } else {
          parsedParam = param.toLowerCase()
        }
      }

      retData.params.push({
        name: abiItem.inputs[i].name,
        value: parsedParam,
        type: abiItem.inputs[i].type
      })
    }

    return retData
  }
}

function _decodeLogs(logs) {
  return logs.map(function(logItem) {
    const methodID = logItem.topics[0].slice(2)
    const method = state.methodIDs[methodID]
    if (method) {
      const logData = logItem.data
      let decodedParams = []
      let dataIndex = 0
      let topicsIndex = 1

      let dataTypes = []
      method.inputs.map(function(input) {
        if (!input.indexed) {
          dataTypes.push(input.type)
        }
      })

      const decodedData = web3.eth.abi.decodeParameters(dataTypes, logData.slice(2))

      // Loop topic and data to get the params
      method.inputs.map(function(param) {
        let decodedP = {
          name: param.name,
          type: param.type
        }

        if (param.indexed) {
          decodedP.value = logItem.topics[topicsIndex]
          topicsIndex++
        } else {
          decodedP.value = decodedData[dataIndex]
          dataIndex++
        }

        if (param.type === 'address') {
          decodedP.value = decodedP.value.toLowerCase()
          // 42 because len(0x) + 40
          if (decodedP.value.length > 42) {
            let toRemove = decodedP.value.length - 42
            let temp = decodedP.value.split('')
            temp.splice(2, toRemove)
            decodedP.value = temp.join('')
          }
        }

        if (param.type === 'uint256' || param.type === 'uint8' || param.type === 'int') {
          decodedP.value = new BN(decodedP.value).toString(10)
        }

        decodedParams.push(decodedP)
      })

      return {
        name: method.name,
        events: decodedParams,
        address: logItem.address
      }
    }
  })
}

export {
  _getABIs as getABIs,
  _addABI as addABI,
  _getMethodIDs as getMethodIDs,
  _decodeMethod as decodeMethod,
  _decodeLogs as decodeLogs,
  _removeABI as removeABI
}