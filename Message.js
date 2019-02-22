const MSG_LEN = 24;

module.exports.Message = class Message{

	constructor(msgFields){
		this.type = msgFields.type;
		this.subType = msgFields.subType;

		this.result = msgFields.result;
		this.param = msgFields.param;

		this.checksumOk = msgFields.checksumOk
	}

	static parseReceived(buff){
		let rawData = Buffer.alloc(MSG_LEN, 0);

		rawData.fill(buff);

		return new this({
			type: rawData.readUInt8(0),
			subType: rawData.readUInt8(1),
			result: rawData.readUInt16LE(5),
			param: rawData.readUInt16LE(2),
			checksumOk: this.calcChecksum(rawData) == rawData.readUInt8(MSG_LEN - 1)
		});
	}

	static calcChecksum(buff){
		let sum = 0;

		for(let i = 0; i < MSG_LEN - 1; i++){
			sum+=buff[i];
		}

		return sum & 0xFF;
	}

	prepareToSend(){
		let rawData = Buffer.alloc(MSG_LEN, 0);

		rawData.writeUInt8(this.type, 0);
		rawData.writeUInt8(this.subType, 1);
		rawData.writeUInt16LE(this.param, 2);

		rawData.writeUInt8(this.constructor.calcChecksum(rawData), MSG_LEN-1);

		return rawData;
	}
};
