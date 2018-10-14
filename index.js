const SerialPort = require('serialport');
const Message = require('./Message.js');

function log(...msg){
	//console.log(...msg);
}

function getSpeed(portName = '/dev/ttyACM0') {

	const firstMessage = Message.Message.createMessage([1]).getData();

	return new Promise((resolve, reject) => {
		let port = new SerialPort(portName, {
				baudRate: 19200,
			},
			(err) => {
				if (err) {
					reject(err);
					return;
				}

				log('opened');

				let firstMessageInterval = setInterval(
					() =>
						port.write(firstMessage),
					1000
				);

				let watchDog;

				function upWatchDog(){
					watchDog = setTimeout(()=>{
							port.close();
							reject('connection to chronograph timeout')
						},
						4000
					)
				}

				function downWatchDog(){
					clearTimeout(watchDog)
				}

				upWatchDog();

				let
					ml = mainLoop(),
					lastWriteBuf = firstMessage,
					checksumErrorCount = 0
				;

				port.on('data', (readBuf) => {
					clearInterval(firstMessageInterval);

					downWatchDog();upWatchDog();

					log('read: ', readBuf);

					let readMsg = Message.Message.parseReceived(readBuf);

					if(!readMsg.checkChecksum() && checksumErrorCount < 4){
						console.error('bad checksum: ', readMsg);
						port.write(lastWriteBuf);
						checksumErrorCount++;
					}else{
						let next = ml.next(readMsg);

						if (next.done) {

							resolve(next.value);
							downWatchDog();
							port.close();

						} else {

							let writeBuf = next.value.getData();
							log('write: ', writeBuf);
							lastWriteBuf = writeBuf;
							port.write(writeBuf);
							
						}
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
		]);

		let countRecordMsg = yield Message.Message.createMessage([
			7, 1
		]);

		let countRecord = countRecordMsg.getRecordCount();

		log('count record', countRecord);

		let speeds = [];

		for (let i = 0; i < countRecord; i++) {
			let recordMsg = yield Message.Message.createMessage([
				7, 2, i
			]);

			speeds.push(recordMsg.getSpeed());
		}

		return speeds;
	}
}


getSpeed(process.argv[2])
	.then(
		(speed) =>
			console.log(speed.join(', '))
	)
	.catch((err)=> {
			console.error(err);
			process.exit();
		}
	)
;