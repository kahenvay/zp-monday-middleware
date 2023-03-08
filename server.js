require('dotenv').config();
const express = require('express');
const axios = require('axios').default;
// const cors = require('cors');

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
	console.log('monday item create');
	console.log('mondayData', mondayData);

	let zpProjectId = '1986721000000671005';

	zohoCreate(mondayData, zpProjectId, '');
});

app.post('/zoho-projects/sub-item-create', (req, res) => {
	res.status(200).send(req.body);

	let mondayData = req.body.event;
	console.log('monday sub item create');
	console.log('mondayData', mondayData);

	let zpProjectId = '1986721000000671005';

	getMondayExternalIdThenCallbackInZoho(
		mondayData,
		zpProjectId,
		'parent',
		'create',
	);
});

// app.post('/zoho-projects/item-update', (req, res) => {
// 	console.log(JSON.stringify(req.body));
// 	res.status(200).send(req.body);
// });

app.post('/zoho-projects/item-name-change', (req, res) => {
	// console.log(JSON.stringify(req.body));
	res.status(200).send(req.body);

	console.log('Monday Name Change');
	let mondayData = req.body.event;
	let zpProjectId = '1986721000000671005';
	getMondayExternalIdThenCallbackInZoho(
		mondayData,
		zpProjectId,
		'this',
		'name', //updating the name of the task
	);
});

app.post('/zoho-projects/column-change', (req, res) => {
	console.log(JSON.stringify(req.body));
	res.status(200).send(req.body);

	console.log('Monday Column Change');
	let mondayData = req.body.event;
	let zpProjectId = '1986721000000671005';
	getMondayExternalIdThenCallbackInZoho(
		mondayData,
		zpProjectId,
		'this',
		'update',
	);
});

app.post('/zoho-projects/delete', (req, res) => {
	console.log(JSON.stringify(req.body));
	res.status(200).send(req.body);

	console.log('Monday delete hook, destination is /zoho-projects/delete');
	let mondayData = req.body.event;
	let zpProjectId = '1986721000000671005';
	getMondayExternalIdThenCallbackInZoho(
		mondayData,
		zpProjectId,
		'this',
		'delete',
	);
	// getMondayExternalId(mondayData.pulseId)
	// 	.then((zohoId) => zohoDelete(zpProjectId, zohoId))
	// 	.catch(console.error);
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

	res.status(200).send(req.body);

	let zpData = req.body;

	// Creating item or subitem
	mondayDelete(zpData);
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
		query = `mutation { create_subitem (create_labels_if_missing: true, parent_item_id: ${zpParentTaksId}, item_name: "${zpData.task_name}", column_values: "{\\"text_1\\": \\"${zpData.task_id}\\"}") { id board { id }}}`;
	} else {
		console.log(' if no got a parent task id ');
		query = `mutation {create_item (create_labels_if_missing: true, board_id: ${mondayBoardId}, group_id: "topics", item_name: "${zpData.task_name}", column_values: "{\\"text_1\\": \\"${zpData.task_id}\\"}") {id}}`;
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
				console.log('there was an error');
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

	let { external_id, task_name, task_status } = zpData;

	console.log('lets update a monday task');

	query = `mutation { change_multiple_column_values (item_id: ${external_id}, board_id: ${mondayBoardId}, column_values: "{\\"name\\": \\"${task_name}\\", \\"status\\": {\\"label\\": \\"${task_status}\\"}}") { id } }`;

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
				console.log('there was an error');
				console.log(JSON.stringify(response.data.errors));
			}
		})
		.catch((err) => console.error(`Error sending to Monday: ${err}`));
}

function mondayDelete(zpData) {
	let query;

	let { external_id } = zpData;

	console.log(`lets delete a monday task ${external_id}`);

	query = `mutation { delete_item (item_id: ${external_id}) { id } }`;

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
			console.log('Deleted in monday!');
			console.log(response.data);
			//add back to ZP the external ID
			if ('errors' in response.data) {
				console.log('there was an error');
				console.log(JSON.stringify(response.data.errors));
			}
		})
		.catch((err) => console.error(`Error sending to Monday: ${err}`));
}

// Like monday, except we know if parentId, we can have create subtask event

function zohoCreate(mondayData, zpProjectId, zpTaskId) {
	axios
		.post(ZP_TOKEN_REFRESH_FULL_URL, {})
		.then((response) => {
			// WILL NEED TO KNOW PROJECT ID SOMEHOW

			let zpUrl;

			if (zpTaskId) {
				// Get parent external ID, which is the zoho id we want
				zpUrl = ZP_BASE_URL + zpProjectId + '/tasks/' + zpTaskId + '/subtasks/';
			} else {
				zpUrl = ZP_BASE_URL + zpProjectId + '/tasks/';
			}

			console.log('zpUrl', zpUrl);

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

					let query = `mutation {change_multiple_column_values(item_id: ${mondayData.pulseId}, board_id: ${mondayData.boardId}, column_values: "{\\"text_1\\": \\"${zpId}\\"}") {id}}`;

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
							console.log(response.data);
							if ('errors' in response.data) {
								console.log('there was an error');
								console.log(JSON.stringify(response.data.errors));
							} else {
								console.log('Added to external ID to monday!');
							}
						})
						.catch((err) => console.error(`Error sending to Monday: ${err}`));
					// })

					//add back to monday the external ID
				})
				.catch((err) => console.error(`Error sending to ZP: ${err}`));
		})
		.catch((err) => console.error(`Error getting refresh Token: ${err}`));
}

// async function getMondayExternalId(mondayId) {
// 	let query = `query { items(ids: [
// 		${mondayId}]) {name, column_values(ids: ["text_1"]) {text} } }`;
// 	try {
// 		const response = await axios.post(
// 			'https://api.monday.com/v2',
// 			{
// 				query: query,
// 			},
// 			{
// 				headers: {
// 					Authorization: 'Bearer ' + process.env.MONDAY_ACCESS_TOKEN,
// 				},
// 			},
// 		);
// 		return response.data.data.items[0].column_values[0].text;
// 	} catch (err) {
// 		if (error.response) {
// 			// Request made but the server responded with an error
// 			console.error('Error getting Id from Monday');
// 			console.error(error.response.data);
// 			console.error(error.response.status);
// 			console.error(error.response.headers);
// 		} else if (error.request) {
// 			// Request made but no response is received from the server.
// 			console.error('Error getting Id from Monday');
// 			console.error(error.request);
// 		} else {
// 			// Error occured while setting up the request
// 			console.error('Error getting Id from Monday');
// 			console.error('Error', error.message);
// 		}
// 	}
// }

function getMondayExternalIdThenCallbackInZoho(
	mondayData,
	zpProjectId,
	thisOrParentExternalId,
	operation,
) {
	// use parentId from mondayData to get Zoho Task Id
	// then call zohoCreate with that ID

	//or

	// use this id get external zoho task id
	// the calll zohoUpdate with that ID

	let mondayId;

	if (thisOrParentExternalId == 'parent') {
		console.log('Getting external ID from monday parent task !');
		mondayId = mondayData.parentItemId;
	} else {
		console.log('Getting external ID from monday this task !');
		mondayId = mondayData.pulseId || mondayData.itemId;
	}

	// let query =
	// 	'query { items(ids: [' +
	// 	mondayId +
	// 	']) {name, column_values(ids: ["text_1"]) {text} } }';

	let query = `query { items(ids: [
		${mondayId}]) {name, column_values(ids: ["text_1"]) {text} } }`;

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
			console.log(JSON.stringify(response.data));
			// console.log(JSON.stringify(response.data.data));
			// console.log(JSON.stringify(response.data.data.items));
			// console.log(JSON.stringify(response.data.data.items[0]));
			// console.log(JSON.stringify(response.data.data.items[0].column_values));
			// console.log(JSON.stringify(response.data.data.items[0].column_values[0]));
			console.log(
				JSON.stringify(response.data.data.items[0].column_values[0].text),
			);
			if ('errors' in response.data) {
				console.log('there was an error');
				console.log(JSON.stringify(response.data.errors));
			} else {
				console.log(
					'got external ID',
					response.data.data.items[0].column_values[0].text,
				);
				if (operation == 'create') {
					console.log("let's go create in ZOHO!");
					zohoCreate(
						mondayData,
						zpProjectId,
						response.data.data.items[0].column_values[0].text,
					);
				} else if (operation == 'update' || operation == 'name') {
					console.log("let's go update in ZOHO!");
					zohoUpdate(
						mondayData,
						zpProjectId,
						response.data.data.items[0].column_values[0].text,
						operation,
					);
				} else {
					console.log("let's go delete in ZOHO!");
					zohoDelete(
						zpProjectId,
						response.data.data.items[0].column_values[0].text,
					);
				}
			}
		})
		.catch((err) => console.error(`Error getting ID from Monday: ${err}`));
}

function zohoUpdate(mondayData, zpProjectId, zpTaskId, operation) {
	axios
		.post(ZP_TOKEN_REFRESH_FULL_URL, {})
		.then((response) => {
			// WILL NEED TO KNOW PROJECT ID SOMEHOW

			let zpUrl = ZP_BASE_URL + zpProjectId + '/tasks/' + zpTaskId + '/';

			let params = {};

			if (operation == 'name') {
				params.name = mondayData.value.name;
			} else {
				// params[mondayData.columnTitle] = mondayData.value.value;
				switch (mondayData.columnTitle) {
					case 'Status':
						// params.task_status = mondayData.value.label.text;
						// TODO : Dictionnary for Status IDs?
						switch (mondayData.value.label.text) {
							case 'Working on it':
								params.custom_status = '1986721000000411165';
								break;
							case 'Stuck':
								params.custom_status = '1986721000000761075';
								break;
							case 'Not Started':
								params.custom_status = '1986721000000761107';
								break;
							case 'Done':
								params.custom_status = '1986721000000411161';
								break;
							case 'Closed':
								params.custom_status = '1986721000000016071';
								break;
							case 'Not Involved':
								params.custom_status = '1986721000000761083';
								break;
						}
						break;
					// case 'Text':
					// 	break;
				}
			}

			console.log('params', params);

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
					console.log('Updated in ZP!');
					console.log('response tasks', response.data.tasks);
				})
				.catch((err) => console.error(`Error updating to ZP: ${err}`));
		})
		.catch((err) => console.error(`Error getting refresh Token: ${err}`));
}

function zohoDelete(zpProjectId, zpTaskId) {
	axios
		.post(ZP_TOKEN_REFRESH_FULL_URL, {})
		.then((response) => {
			// WILL NEED TO KNOW PROJECT ID SOMEHOW

			// console.log('zoho auth response', response.data.scope);

			let zpUrl = ZP_BASE_URL + zpProjectId + '/tasks/' + zpTaskId + '/';

			console.log('zpUrl', zpUrl);

			axios
				.delete(zpUrl, {
					headers: { Authorization: 'Bearer ' + response.data.access_token },
				})
				.then((response) => {
					console.log('Delete in ZP!');
					console.log('response', response);
				})
				.catch((err) => {
					console.error(`Error sending to ZP: ${err}`);
					// console.log(JSON.stringify(err));
				});
		})
		.catch((err) => console.error(`Error getting refresh Token: ${err}`));
}
