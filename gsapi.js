module.exports = GSAPI

// EXAMPLE USAGE:
// var gsapi = new GSAPI({
// 	clientId: 'foo',
// 	spreadsheetId: 'bar'
// })
// gsapi.signIn()
// gsapi.getAll('cars', cars => cars.map(car => console.log(car)))
// gsapi.insert('cars', ['Toyota', 'Prius', 2016, 'any data really'])

function GSAPI (config, onInit) {
	var gapi = window.gapi

	if (!gapi)
		throw new Error('GSAPI: Google Sheets API not found! https://apis.google.com/js/api.js must be loaded first.')
	if (!config)
		throw new Error('GSAPI: You must provide a configuration object to the constructor. E.g. { clientId: "foo", spreadsheetId: "bar" }')
	if (!config.clientId)
		throw new Error('GSAPI: You must provide a clientId as configuration to the constructor. Get one from Google Cloud Console')
	if (!config.spreadsheetId)
		throw new Error('GSAPI: You must provide a spreadsheetId as configuration to the constructor. Get one from the adress bar when opening a Google Spreadsheet')

	var isInitialized = false
	var isSignedIn = false

	gapi.load('client:auth2', function () {
		var callback = onInit || function () {}
    gapi.client.init({
			discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
			clientId: config.clientId,
			scope: 'https://www.googleapis.com/auth/spreadsheets'
		}).then(function () {
			isInitialized = true
			callback()
		})
  })

	function signIn (callback) {
		if (!isInitialized) throw new Error('GSAPI: Client API not initialized yet.')
		callback = callback || function () {}
		isSignedIn = gapi.auth2.getAuthInstance().isSignedIn.get()
		if (isSignedIn) {
			callback(true)
			return
		}
		gapi.auth2.getAuthInstance().isSignedIn.listen(value => {
			isSignedIn = value
			callback(value)
		})
		gapi.auth2.getAuthInstance().signIn()
	}

	function signOut () {
		gapi.auth2.getAuthInstance().signOut()
	}

	function get (resource, id, callback) {
		checkIfOperational()
		gapi.client.sheets.spreadsheets.values
		.get({
      spreadsheetId: config.spreadsheetId,
      range: ['' + resource + '!A' + id + ':Z' + id]
    })
		.then(parseResponse, handleError)
		.then(function (data) {
			return data.values ? data.values[0] : []
		})
		.then(callback)
	}

	function getAll (resource, callback) {
		checkIfOperational()
		gapi.client.sheets.spreadsheets.values
		.batchGet({
      spreadsheetId: config.spreadsheetId,
      ranges: ['' + resource + '!A:Z']
    })
		.then(parseResponse, handleError)
		.then(function (data) { return data.valueRanges[0].values })
		.then(callback)
	}

	function insert (resource, data, callback) {
		checkIfOperational()
		gapi.client.sheets.spreadsheets.values
		.append({
			spreadsheetId: config.spreadsheetId,
			range: '' + resource + '!A1',
			valueInputOption: 'USER_ENTERED',
			insertDataOption: 'INSERT_ROWS',
			values: [data]
		})
		.then(parseResponse, handleError)
		.then(function (data) {
			const range = data.updatedRange || data.updates.updatedRange
			return parseInt(range.split('!A')[1].split(':')[0], 10)
		})
		.then(callback)
	}

	function update (resource, id, data, callback) {
		checkIfOperational()
		gapi.client.sheets.spreadsheets.values
		.update({
			spreadsheetId: config.spreadsheetId,
			range: '' + resource + '!A' + id + ':Z' + id,
			valueInputOption: 'USER_ENTERED',
			values: [data]
		})
		.then(parseResponse, handleError)
		.then(function (data) { return true })
		.then(callback)
	}

	function remove (resource, id, callback) {
		checkIfOperational()
		gapi.client.sheets.spreadsheets.values
		.clear({
			spreadsheetId: config.spreadsheetId,
			range: '' + resource + '!A' + id + ':Z' + id
		})
		.then(parseResponse, handleError)
		.then(function (data) { return true })
		.then(callback)
	}

	function checkIfOperational () {
		if (!isInitialized)
			throw new Error('GSAPI: Cannot execute operation since the API is not initialized.')
		if (!isSignedIn)
			throw new Error('GSAPI: Cannot execute operation since the user is not signed in.')
	}

	function parseResponse (response) {
		return JSON.parse(response.body)
	}

	function handleError (response) {
		throw new Error('GSAPI: ' + JSON.parse(response.body).error.message)
	}

	return {
		signIn,
		signOut,
		get,
		getAll,
		insert,
		update,
		remove
	}
}