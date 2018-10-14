const SerialPort = require('serialport');
const Message = require('./Message.js');

function getSpeed() {

	const firstMessage = Message.Message.createMessage([1]).getData();

	let firstMessageInterval;

	return new Promise((resolve, reject) => {
		let port = new SerialPort('/dev/ttyACM0', {
				baudRate: 19200,
			},
			(err) => {
				if (err) {
					reject(err);
					return;
				}

				console.log('opened');

				firstMessageInterval = setInterval(
					() =>
						port.write(firstMessage),
					1000
				);

				let ml = mainLoop();

				port.on('data', (readBuf) => {
					console.log('read: ', readBuf);

					let next = ml.next(readBuf);

					if (next.done) {
						resolve(next.value);
						port.close();
					} else {
						port.write(next.value);
						console.log('write: ', next.value);
					}
				});
			}
		)
			.on('error', (err) =>
				reject(err)
			);
	});

	function* mainLoop() {
		yield Message.Message.createMessage([
			7, 0, 0, 0, 0, 0x18, 0xFB
		]).getData();

		clearInterval(firstMessageInterval);

		let countRecordMsg = Message.Message.parseRecived(yield Message.Message.createMessage([
			7, 1
		]).getData());

		let countRecord = countRecordMsg.getData().readUInt8(5);

		console.log('count record', countRecord);

		let speeds = [];

		for (let i = 0; i < countRecord; i++) {
			let recordMsg = Message.Message.parseRecived(yield Message.Message.createMessage([
				7, 2, i
			]).getData());

			speeds.push(recordMsg.getData().readUInt16LE(5) / 10);
		}

		return speeds;
	}
}


getSpeed().then(
	(speed) =>
		console.log(speed.join(', '))
);