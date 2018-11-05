const SerialPort = require('serialport');
const {Message} = require('./Message.js');

function log(...msg){
	console.log(...msg);
}

function getSpeed(portName = '/dev/ttyACM0') {

	const firstMessage = new Message({type:1}).prepareToSend();

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

					let readMsg = Message.parseReceived(readBuf);

					if(!readMsg.checksumOk && checksumErrorCount < 4){
						console.error('bad checksum: ', readMsg);
						port.write(lastWriteBuf);
						checksumErrorCount++;
					}else{
						checksumErrorCount = 0;

						let next = ml.next(readMsg);

						if (next.done) {

							resolve(next.value);
							downWatchDog();
							port.close();

						} else {

							let writeBuf = next.value.prepareToSend();
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
		let modeMessage = yield new Message({ // запрос типа имеюших результатов
			type: 7,
			subType: 0,
			param: 0x18FB
		});

		let countRecordMsg = yield new Message({ // запрос количества результатов
			type:7,
			subType:1
		});

		let countRecord = countRecordMsg.result;

		log('count record', countRecord);

		let speeds = [], delays = [];

		switch (modeMessage.result) {
			case(0):{ // только скорость
					for (let i = 0; i < countRecord; i++) {
						let recordMsg = yield new Message({ // запрос каждого результата
							type:7,
							subType: 2,
							param: i
						});

						speeds.push(recordMsg.result / 10);
					}
				}
				break;
			case(1):{ // скорость и скорострельность
					for (let i = 1; i < countRecord; i++) {  // 1й результат всегда 0/65000
						let speedMsg = yield new Message({ // запрос скорости
							type:7,
							subType: 2,
							param: i*2
						});

						speeds.push(speedMsg.result / 10);

						let delayMsg = yield new Message({ // запрос интервалов
							type:7,
							subType: 2,
							param: i*2+1
						});

						delays.push(delayMsg.result / 1000);
					}
				}
				break;
			default:
				throw Error('unknown chrone mode')
		}


		return {speeds, delays};
	}
}


getSpeed(process.argv[2])
	.then(
		(result) =>
			console.log(result)
	)
	.catch((err)=> {
			console.error(err);
			process.exit();
		}
	)
;