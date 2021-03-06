const SerialPort = require('serialport');
const {Message} = require('./Message.js');
const path = require('path');
const fs = require('fs');

function log(...msg){
	console.log(...msg);
}

function getSpeed(portName = '/dev/ttyACM0') {

	const firstMessage = new Message({type:1}).prepareToSend();

	return new Promise((resolve, reject) => {
		let port = new SerialPort(portName, {
				baudRate: 19200,
				autoOpen: true,
				dataBits: 8,
				hupcl: true,
				lock: true,
				parity: 'none',
				rtscts: false,
				stopBits: 1,
				xany: false,
				xoff: false,
				xon: false,
				highWaterMark: 64 * 1024,
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
						10000
					)
				}

				function downWatchDog(){
					clearTimeout(watchDog)
				}

				upWatchDog();

				let
					ml = mainLoop(),
					lastWriteBuf = firstMessage,
					lastMessage = null;
					checksumErrorCount = 0
				;

				port.on('data', (readBuf) => {
					clearInterval(firstMessageInterval);

					downWatchDog();upWatchDog();

					log('read: ', readBuf);

					let readMsg = Message.parseReceived(readBuf);

					if(
						(!readMsg.checksumOk && checksumErrorCount < 4)
						|| (lastMessage && (
								( (readMsg.type != lastMessage.type) || (readMsg.subType != lastMessage.subType) )
								|| ( (lastMessage.type == 7) && (lastMessage.subType == 2) && (lastMessage.param != readMsg.param))
							)
						)
					){
						if(readMsg.checksumOk) {
							console.error('bug message order');
						}else{
							console.error( 'bad checksum: ', readMsg);
						}
						port.write(lastWriteBuf);
						log('write (repeat): ', lastWriteBuf);

						checksumErrorCount++;
					}else{
						checksumErrorCount = 0;

						let next = ml.next(readMsg);

						if (next.done) {

							resolve(next.value);
							downWatchDog();
							port.close();

						} else {
							if(next.value !== null) {
								lastMessage = next.value;
								let writeBuf = lastMessage.prepareToSend();
								log('write: ', writeBuf);
								lastWriteBuf = writeBuf;
								setTimeout( ()=>port.write(writeBuf), 200);
							}
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

		let speeds = [], rateOfFire = [], type;

		switch (modeMessage.result) {
			case(0):{ // только скорость
					type = 'speed';

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
					type = 'speed,rateOfFire';

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

						rateOfFire.push(delayMsg.result / 1000);
					}
				}
				break;

			default:
				throw Error('unknown chrone mode')
		}

//		yield new Message({type:8, subType: 1}); // очистка данных на хроне
		// type:8, subType:0 - в режиме с подсчётом скорострельности чистит только данные интервалов

		return {speeds, rateOfFire, type};
	}
}

function saveResult(result){
	fs.open(path.join(process.cwd(), 'results', Date.now().toString() + '.json'), 'w', (err, hFile) =>
		!err && fs.write(hFile, JSON.stringify(result), (err) =>
			fs.close(hFile, f=>f)
		)
	)
}


getSpeed(process.argv[2])
	.then(
		(result) => {
			console.log(result);
			if(result.speeds.length){
				result.chroneModel = 'strelok_acc-0015';
				saveResult(result);
			}
		}
	)
	.catch((err)=> {
			console.error(err);
			process.exit();
		}
	)
;
