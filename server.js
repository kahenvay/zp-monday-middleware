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

app.post('/zoho-projects/item-create', (req, res) => {
	res.status(200).send(req.body);

	let mondayData = req.body.event;
	console.log('mondayData', mondayData);

	axios
		.post(ZP_TOKEN_REFRESH_FULL_URL, {})
		.then((response) => {
			// WILL NEED TO KNOW PROJECT ID SOMEHOW
			let zpProjectId = '1986721000000671005';
			let zpUrl = ZP_BASE_URL + zpProjectId + '/tasks/';

			let params = {
				// person_responsible: '783689839', // MAYBE NEED LIST OF USERS TO AVOID EXTRA CALL TO ZOHO, COMPARE MONDAY LIST TO ZP LIST, THIS USER IS AYESHA
				name: mondayData.pulseName,
				// created_by:
				// MAYBE SHOULD HAVE THESE ON ZOHO AX monday_external_ids
				// boardId: 3975323293,
				custom_fields: { UDF_CHAR1: mondayData.pulseId },
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
					console.log('response tasks', response.data.tasks);
					let zpId = response.data.tasks[0].id_string;

					// console.log('zpId', zpId);

					let query =
						'mutation {change_multiple_column_values(item_id: ' +
						mondayData.pulseId +
						', board_id:' +
						mondayData.boardId +
						', column_values: "{\\"text_1\\" : \\"' +
						zpId +
						'\\"}") {id}}';

					axios
						.post(
							'https://api.monday.com/v2',
							{
								query: query,
							},
							{
								headers: {
									Authorization: 'Bearer ' + process.env.MONDAY_ACCESS_TOKEN,
								},
							},
						)
						.then((response) => {
							console.log('Added to external ID to monday!');
							console.log(response.data);
							if ('errors' in response.data) {
								console.log(JSON.stringify(response.data.errors));
							}
						})
						.catch((err) => console.error(`Error sending to Monday: ${err}`));
					// })

					//add back to monday the external ID
				})
				.catch((err) => console.error(`Error sending to ZP: ${err}`));
		})
		.catch((err) => console.error(`Error getting refresh Token: ${err}`));
});

app.post('/zoho-projects/item-update', (req, res) => {
	console.log(JSON.stringify(req.body));
	res.status(200).send(req.body);
});

app.post('/zoho-projects/column-change', (req, res) => {
	console.log(JSON.stringify(req.body));
	res.status(200).send(req.body);
});

app.post('/monday/create', (req, res) => {
	console.log('--');
	console.log('starting monday create webhook handler');
	// console.log(req);
	console.log(JSON.stringify(req.body));
	console.log('--');

	res.status(200).send(req.body);

	let zpData = req.body;

	// WILL NEED TO KNOW BOARD ID SOMEHOW
	let mondayBoardId = '3975323293';

	// Creating item or subitem
	zpCheckIfHasParentTaksIdThenCreate(
		zpData.project_id,
		zpData.task_id,
		zpData,
		mondayBoardId,
	);
});

app.post('/monday/update', (req, res) => {
	console.log('--');
	console.log('starting monday update webhook handler');
	// console.log(req);
	console.log(JSON.stringify(req.body));
	console.log('--');

	res.status(200).send(req.body);

	let zpData = req.body;

	// WILL NEED TO KNOW BOARD ID SOMEHOW
	let mondayBoardId = '3975323293';

	// Creating item or subitem
	mondayUpdate(zpData, mondayBoardId);
});

app.post('/monday/delete', (req, res) => {
	console.log('--');
	console.log('starting monday delete webhook handler');
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

function zpCheckIfHasParentTaksIdThenCreate(
	zpProjectId,
	task_id,
	zpData,
	mondayBoardId,
) {
	axios
		.post(ZP_TOKEN_REFRESH_FULL_URL, {})
		.then((response) => {
			axios
				.post(
					ZP_BASE_URL + zpProjectId + '/tasks/' + task_id + '/',
					{},
					{
						headers: {
							Authorization: 'Bearer ' + response.data.access_token,
						},
					},
				)
				.then((response) => {
					// console.log('got response from zp', response);
					if ('parent_task_id' in response.data.tasks[0]) {
						console.log('It has a parent!');
						let parent_task_id = response.data.tasks[0].parent_task_id;
						axios
							.post(ZP_TOKEN_REFRESH_FULL_URL, {})
							.then((response) => {
								axios
									.post(
										ZP_BASE_URL +
											zpProjectId +
											'/tasks/' +
											parent_task_id +
											'/',
										{},
										{
											headers: {
												Authorization: 'Bearer ' + response.data.access_token,
											},
										},
									)
									.then((response) => {
										console.log('Got parent ZP task', response.data.tasks[0]);
										let externalId =
											response.data.tasks[0].custom_fields.find(isExternalId);
										console.log('ZP Task External ID', externalId);
										// return externalId;
										mondayCreate(zpData, mondayBoardId, externalId.value);
									})
									.catch((err) => {
										console.error(
											`Error gettin parent ZP for external ID: ${err}`,
										);
										console.error(JSON.stringify(err.response.data));
									});
							})
							.catch((err) =>
								console.error(`Error getting refresh Token: ${err}`),
							);
					} else {
						console.log('ZP task has no parent id');
						mondayCreate(zpData, mondayBoardId);
					}
				})
				.catch((err) => {
					console.error(`Error getting from ZP: ${err}`);
					console.error(JSON.stringify(err.response.data));
				});
		})
		.catch((err) => console.error(`Error getting refresh Token: ${err}`));
}

function isExternalId(custom_field) {
	return (custom_field.column_name = 'UDF_CHAR1'); // external ID
}

function mondayCreate(zpData, mondayBoardId, zpParentTaksId) {
	let query;

	console.log('lets creat a monday task');
	console.log('value of zpParentTaksId', zpParentTaksId);

	if (zpParentTaksId) {
		console.log(' if got a parent task id ');
		query =
			'mutation { create_subitem (create_labels_if_missing: true, parent_item_id: ' +
			zpParentTaksId +
			', item_name: "' +
			zpData.task_name +
			'", column_values: "{\\"text_1\\": \\"' +
			zpData.task_id +
			'\\"}") { id board { id }}}';
	} else {
		console.log(' if no got a parent task id ');
		query =
			'mutation {create_item (create_labels_if_missing: true, board_id: ' +
			mondayBoardId +
			', group_id: "topics", item_name: "' +
			zpData.task_name +
			'", column_values: "{\\"text_1\\": \\"' +
			zpData.task_id +
			'\\"}") {id}}';
	}

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
			//add back to ZP the external ID
			if ('errors' in response.data) {
				console.log(JSON.stringify(response.data.errors));
			} else {
				let mondayId;
				if (zpParentTaksId) {
					mondayId = response.data.data.create_subitem.id + '';
				} else {
					mondayId = response.data.data.create_item.id + '';
				}

				console.log('mondayId', mondayId);

				// WILL NEED TO KNOW PROJECT ID SOMEHOW
				let zpProjectId = '1986721000000671005';
				let zpUpdateUrl =
					ZP_BASE_URL + zpProjectId + '/tasks/' + zpData.task_id + '/';

				let externalIdJson = JSON.stringify({ UDF_CHAR1: mondayId });

				console.log('externalIdJson', externalIdJson);

				axios
					.post(ZP_TOKEN_REFRESH_FULL_URL, {})
					.then((response) => {
						let params = {
							custom_fields: externalIdJson,
						};

						axios
							.post(
								zpUpdateUrl,
								{},
								{
									headers: {
										Authorization: 'Bearer ' + response.data.access_token,
									},
									params: params,
								},
							)
							.then((response) => {
								console.log('Added external ID to ZP!');
							})
							.catch((err) => {
								console.error(`Error sending to ZP: ${err}`);
								console.error(JSON.stringify(err.response.data));
							});
					})
					.catch((err) => console.error(`Error getting refresh Token: ${err}`));
			}
		})
		.catch((err) => console.error(`Error sending to Monday: ${err}`));
}

function mondayUpdate(zpData, mondayBoardId) {
	let query;

	console.log('lets update a monday task');

	query =
		'mutation { change_multiple_column_values (item_id: ' +
		zpData.external_id +
		', board_id: ' +
		mondayBoardId +
		', column_values: "{\\"name\\": \\"' +
		zpData.task_name +
		'\\"}") { id } }';

	// ', column_values: "{\\"text\\": \\"Some different text\\"}") { id } }';

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
			console.log('Updated in monday!');
			console.log(response.data);
			//add back to ZP the external ID
			if ('errors' in response.data) {
				console.log(JSON.stringify(response.data.errors));
			}
		})
		.catch((err) => console.error(`Error sending to Monday: ${err}`));
}
