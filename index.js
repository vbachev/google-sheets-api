module.exports = GSAPI

// EXAMPLE USAGE:
// var gsapi = new GSAPI('foo', () => {
// 	gsapi.setSpreadsheetId('bar')
// 	gsapi.signIn(() => {
// 		gsapi.getAll('cars', cars => cars.map(car => console.log(car)))
// 		gsapi.insert('cars', ['Toyota', 'Prius', 2016, 'any data really'])
// 	})
// })

function GSAPI (clientId, onInit) {
	var _gapi = window.gapi

	if (!_gapi)
		throw new Error('GSAPI: Google Sheets API not found! https://apis.google.com/js/api.js must be loaded first.')
	if (!clientId)
		throw new Error('GSAPI: You must provide a clientId as argument to the constructor. Get one from Google Cloud Console')

	var _isInitialized = false
	var _isSignedIn = false

	_gapi.load('client:auth2', function () {
		var callback = onInit || function () {}
    _gapi.client.init({
			discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
			clientId: clientId,
			scope: 'https://www.googleapis.com/auth/spreadsheets'
		}).then(function () {
			_isInitialized = true
			_isSignedIn = _gapi.auth2.getAuthInstance().isSignedIn.get()
			_gapi.auth2.getAuthInstance().isSignedIn.listen(function (value) {
				_isSignedIn = value
			})
			callback()
		})
  })

	function signIn (callback) {
		if (!_isInitialized) throw new Error('GSAPI: Client API not initialized yet.')
		callback = callback || function () {}
		if (_isSignedIn) {
			callback(true)
			return
		}
		_gapi.auth2.getAuthInstance().isSignedIn.listen(function (value) {
			// @TODO: this should execute only once (ie .once())
			callback(value)
		})
		_gapi.auth2.getAuthInstance().signIn()
	}

	function signOut () {
		// @TODO: callback
		_gapi.auth2.getAuthInstance().signOut()
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

	function setSpreadsheetId (id) {
		_spreadsheetId = id
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
		return JSON.parse(response.body)
	}

	function _handleError (response) {
		throw new Error('GSAPI: ' + JSON.parse(response.body).error.message)
	}

	return {
		isInitialized: function () { return _isInitialized },
		setSpreadsheetId: setSpreadsheetId,
		get: get,
		getAll: getAll,
		insert: insert,
		update: update,
		remove: remove,
		user: {
			isSignedIn: function () { return _isSignedIn },
			signIn: signIn,
			signOut: signOut,
			getProfile: getProfile
		}
	}
}