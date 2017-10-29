# google-sheets-api

A handy wrapper over the Google Sheets API v4

Lets you use a spreadsheet as an app's database

## Example

      var GSAPI = require('gsapi')
      var gsapi = new GSAPI({
        clientId: 'foo',
        spreadsheet: { name: 'foo' sheets: ['cars', 'customers'] },
      }, () => {
      	gsapi.signIn(() => {
      		gsapi.getAll('cars', cars => cars.map(car => console.log(car)))
      		gsapi.insert('cars', ['Toyota', 'Prius', 2016, 'any data really'])
      	})
      })
