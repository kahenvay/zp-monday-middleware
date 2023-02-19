require('dotenv').config();
const express = require('express');
const axios = require('axios').default;
var cors = require('cors');

const ZP_TOKEN_REFRESH_ENDPOINT = 'https://accounts.zoho.com/oauth/v2/token';
const MONDAY_TOKEN_REFRESH_ENDPOINT = 'https://auth.monday.com/oauth2/token';

const ZP_TOKEN_REFRESH_FULL_URL =
	ZP_TOKEN_REFRESH_ENDPOINT +
	'?refresh_token=' +
	process.env.ZP_REFRESH_TOKEN +
	'&client_id=' +
	process.env.ZP_CLIENT_ID +
	'&client_secret=' +
	process.env.ZP_CLIENT_SECRET +
	'&grant_type=refresh_token';

const MONDAY_TOKEN_FULL_URL =
	MONDAY_TOKEN_REFRESH_ENDPOINT +
	'?code=' +
	process.env.MONDAY_CODE +
	'&redirect_uri=' +
	process.env.REDIRECT_URL +
	'&client_id=' +
	process.env.MONDAY_CLIENT_ID +
	'&client_secret=' +
	process.env.MONDAY_CLIENT_SECRET;

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded());

const ZP_BASE_URL =
	'https://projectsapi.zoho.com/restapi/portal/' +
	process.env.ZP_PORTAL_ID +
	'/projects/';

app.get('/', (req, res) =>
	res.send(`
  <html>
    <head><title>Success!</title></head>
    <body>
      <h1>You did it!</h1>
      <img src="https://media.giphy.com/media/XreQmk7ETCak0/giphy.gif" alt="Cool kid doing thumbs up" />
    </body>
  </html>
`),
);

app.post('/monday/item-create', (req, res) => {
	let zpData = req.body.event;

	axios
		.post(ZP_TOKEN_REFRESH_FULL_URL, {})
		.then((response) => {
			// WILL NEED TO KNOW PROJECT ID SOMEHOW
			let zpProjectId = '1986721000000671005';
			let zpUrl = ZP_BASE_URL + zpProjectId + '/tasks/';

			let params = {
				// person_responsible: '783689839', // MAYBE NEED LIST OF USERS TO AVOID EXTRA CALL TO ZOHO, COMPARE MONDAY LIST TO ZP LIST, THIS USER IS AYESHA
				name: zpData.pulseName,
				// created_by:
				// MAYBE SHOULD HAVE THESE ON ZOHO AX monday_external_ids
				//"boardId": 3975323293,
				//"pulseId": 4009838089,
				//and maybe
				//"groupId": "topics",
				//"groupName": "Professional",
			};

			axios
				.post(
					zpUrl,
					{},
					{
						headers: { Authorization: 'Bearer ' + response.data.access_token },
						params: params,
					},
				)
				.then((response) => {
					console.log('Added to ZP!');
					// console.log('response tasks', response.data.tasks);
				})
				.catch((err) => console.error(`Error sending to ZP: ${err}`));
		})
		.catch((err) => console.error(`Error getting refresh Token: ${err}`));
});

app.post('/monday/item-update', (req, res) => {
	console.log(JSON.stringify(req.body));
	res.status(200).send(req.body);
});

app.post('/monday/column-change', (req, res) => {
	console.log(JSON.stringify(req.body));
	res.status(200).send(req.body);
});

app.post('/zoho-projects/create', (req, res) => {
	console.log('--');
	// console.log(req);
	console.log(JSON.stringify(req.body));
	console.log('--');

	let mondayData = req.body;

	// axios
	// 	.post(MONDAY_TOKEN_FULL_URL, {})
	// 	.then((response) => {
	// WILL NEED TO KNOW BOARD ID SOMEHOW
	let mondayBoardId = '3975323293';

	// let query = `mutation { create_item (board_id: ${mondayBoardId}, group_id: "today", item_name: ${mondayData.task_name}) { id }}"`;
	let query =
		'mutation {create_item (board_id: ' +
		mondayBoardId +
		', group_id: "topics", item_name: "' +
		mondayData.task_name +
		'") {id}}';

	axios
		.post(
			'https://api.monday.com/v2',
			{
				query: query,
			},
			{
				headers: { Authorization: 'Bearer ' + process.env.MONDAY_ACCESS_TOKEN },
			},
		)
		.then((response) => {
			console.log('Added to monday!');
			console.log(response.data);
			if ('errors' in response.data) {
				console.log(JSON.stringify(response.data.errors));
			}
		})
		.catch((err) => console.error(`Error sending to Monday: ${err}`));
	// })
	// .catch((err) => console.error(`Error getting refresh Token: ${err}`));
});

app.post('/zoho-projects/update', (req, res) => {
	console.log('--');
	console.log(JSON.stringify(req.body));
	console.log('--');
});

app.post('/zoho-projects/delete', (req, res) => {
	console.log('--');
	console.log(JSON.stringify(req.body));
	console.log('--');
});

app.use((error, req, res, next) => {
	res.status(500);
	res.send({ error: error });
	console.error(error.stack);
	next(error);
});

app.listen(port, () =>
	console.log(`Example app listening at http://localhost:${port}`),
);
