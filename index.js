module.exports = GSAPI

// EXAMPLE USAGE:
// var gsapi = new GSAPI({
//   clientId: 'foo',
//   spreadsheet: { name: 'foo' sheets: ['cars', 'customers'] },
// }, () => {
// 	gsapi.signIn(() => {
// 		gsapi.getAll('cars', cars => cars.map(car => console.log(car)))
// 		gsapi.insert('cars', ['Toyota', 'Prius', 2016, 'any data really'])
// 	})
// })

function GSAPI (config, onInit) {
	var _gapi = window.gapi

	if (!_gapi)
		throw new Error('GSAPI: Google Sheets API not found! https://apis.google.com/js/api.js must be loaded first.')
	if (!config.clientId)
		throw new Error('GSAPI: You must provide a clientId field in the config argument to the constructor. Get one from Google Cloud Console')
	if (!config.spreadsheet)
		throw new Error('GSAPI: You must provide a spreadsheet field in the config argument to the constructor. Its structure has to include the keys "name" (string) and "sheets" (array of strings)')

	var _isInitialized = false
	var _isSignedIn = false
	var _spreadsheetId = ''

	_gapi.load('client:auth2', function () {
		var callback = onInit || function () {}
    _gapi.client.init({
			discoveryDocs: [
				'https://sheets.googleapis.com/$discovery/rest?version=v4',
				'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
			],
			clientId: config.clientId,
			scope: 'https://www.googleapis.com/auth/drive.file'
		}).then(function () {
			_isInitialized = true
			_isSignedIn = _gapi.auth2.getAuthInstance().isSignedIn.get()
			_gapi.auth2.getAuthInstance().isSignedIn.listen(function (value) {
				_isSignedIn = value
			})
			if (_isSignedIn)
				_setSpreadsheetId(callback)
			else
				callback()
		})
  })

	function signIn (callback) {
		if (!_isInitialized) throw new Error('GSAPI: Client API not initialized yet.')
		if (_isSignedIn) {
			callback(true)
			return
		}
		_gapi.auth2.getAuthInstance().signIn()
		.then(function () {
			_setSpreadsheetId(callback.bind(this, true))
		}, _handleError)
	}

	function signOut (callback) {
		_gapi.auth2.getAuthInstance().signOut()
		.then(callback, _handleError)
	}

	function getProfile () {
		if (!_isSignedIn) return
		const profile = _gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile()
		return {
			id: profile.getId(),
			name: profile.getName(),
			email: profile.getEmail(),
			image: profile.getImageUrl(),
		}
	}

	function _setSpreadsheetId (callback) {
		_getSpreadsheetId(function (id) {
			_spreadsheetId = id
			callback()
		})
	}

	function _getSpreadsheetId (callback) {
		getSpreadsheet(function (spreadsheet) {
			if (spreadsheet) {
				callback(spreadsheet.spreadsheetId)
			} else {
				_createSpreadsheet(function (spreadsheet) {
					callback(spreadsheet.spreadsheetId)
				})
			}
		})
	}

	function getSpreadsheet (callback) {
		if (_spreadsheetId) {
			_getSpreadsheetById(_spreadsheetId, function (spreadsheet) {
				callback(spreadsheet)
			})
			return
		}
		_getFileByName(config.spreadsheet.name, function (file) {
			if (!file) {
				callback()
			} else {
				_getSpreadsheetById(file.id, function (spreadsheet) {
					callback(spreadsheet)
				})
			}
		})
	}

	function _getFileByName (name, callback) {
		_gapi.client.drive.files
		.list({
			corpora: 'user',
			spaces: 'drive',
			q: "name = '" + name + "'"
		})
		.then(_parseResponse, _handleError)
		.then(function (result) {
			return result.files[0]
		})
		.then(callback)
	}

	function _getSpreadsheetById (id, callback) {
		_gapi.client.sheets.spreadsheets
		.get({ spreadsheetId: id })
		.then(_parseResponse, _handleError)
		.then(callback)
	}

	function _createSpreadsheet (callback) {
		_gapi.client.sheets.spreadsheets.create({}, {
			properties: {
				title: config.spreadsheet.name,
				locale: 'en'
			},
			sheets: config.spreadsheet.sheets.map(function (sheetName) {
				return { properties: { title: sheetName } }
			})
		})
		.then(_parseResponse, _handleError)
		.then(callback)
	}

	function get (sheetName, id, callback) {
		_checkIfOperational()
		_gapi.client.sheets.spreadsheets.values
		.get({
      spreadsheetId: _spreadsheetId,
      range: ['' + sheetName + '!A' + id + ':Z' + id]
    })
		.then(_parseResponse, _handleError)
		.then(function (data) {
			return data.values ? data.values[0] : []
		})
		.then(callback)
	}

	function getAll (sheetName, callback) {
		_checkIfOperational()
		_gapi.client.sheets.spreadsheets.values
		.batchGet({
      spreadsheetId: _spreadsheetId,
      ranges: ['' + sheetName + '!A:Z']
    })
		.then(_parseResponse, _handleError)
		.then(function (data) { return data.valueRanges[0].values })
		.then(callback)
	}

	function insert (sheetName, data, callback) {
		_checkIfOperational()
		_gapi.client.sheets.spreadsheets.values
		.append({
			spreadsheetId: _spreadsheetId,
			range: '' + sheetName + '!A1',
			valueInputOption: 'USER_ENTERED',
			insertDataOption: 'INSERT_ROWS',
			values: [data]
		})
		.then(_parseResponse, _handleError)
		.then(function (data) {
			var range = data.updatedRange || data.updates.updatedRange
			return parseInt(range.split('!A')[1].split(':')[0], 10)
		})
		.then(callback)
	}

	function update (sheetName, id, data, callback) {
		_checkIfOperational()
		_gapi.client.sheets.spreadsheets.values
		.update({
			spreadsheetId: _spreadsheetId,
			range: '' + sheetName + '!A' + id + ':Z' + id,
			valueInputOption: 'USER_ENTERED',
			values: [data]
		})
		.then(_parseResponse, _handleError)
		.then(function (data) { return true })
		.then(callback)
	}

	function remove (sheetName, id, callback) {
		_checkIfOperational()
		_gapi.client.sheets.spreadsheets.values
		.clear({
			spreadsheetId: _spreadsheetId,
			range: '' + sheetName + '!A' + id + ':Z' + id
		})
		.then(_parseResponse, _handleError)
		.then(function (data) { return true })
		.then(callback)
	}

	function _checkIfOperational () {
		if (!_isInitialized)
			throw new Error('GSAPI: API is not initialized.')
		if (!_isSignedIn)
			throw new Error('GSAPI: user is not signed in.')
		if (!_spreadsheetId)
			throw new Error('GSAPI: spreadsheetId is not provided. Get one from the adress bar when opening a Google Spreadsheet')
	}

	function _parseResponse (response) {
		return response.result
	}

	function _handleError (response) {
		throw new Error('GSAPI: ' + JSON.parse(response.body).error.message)
	}

	return {
		isInitialized: function () { return _isInitialized },
		get: get,
		getAll: getAll,
		insert: insert,
		update: update,
		remove: remove,
		getSpreadsheet: getSpreadsheet,
		user: {
			isSignedIn: function () { return _isSignedIn },
			signIn: signIn,
			signOut: signOut,
			getProfile: getProfile
		}
	}
}