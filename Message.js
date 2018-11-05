module.exports.Message = class Message{
	constructor(){
		this.MSG_LEN = 24;
		this.data = Buffer.alloc(this.MSG_LEN, 0);
	}
	
	static createMessage(arr){
		let msg = new Message();

		msg.data.fill(Buffer.from(arr), 0, arr.length);
		msg.data[msg.MSG_LEN - 1] = msg.calcChecksum();

		return msg;
	}

	static parseReceived(buff){
		let msg = new Message();

		msg.data.fill(buff);
		return msg;
	}

	calcChecksum(){
		let sum = 0;

		for(let i = 0; i < this.MSG_LEN - 1; i++){
			sum+=this.data[i];
		}

		return sum & 0xFF;
	}

	checkChecksum(){
		return this.calcChecksum() == this.data[this.MSG_LEN - 1];
	}

	getData(){
		return this.data;
	}

	getRecordCount(){
		if( (this.data.readUInt8(0) == 7) && (this.data.readUInt8(1) == 1) ){
			return this.data.readUInt8(5)
		}else {
			throw new Error('invalid message type')
		}
	}

	getSpeed(){
		if( (this.data.readUInt8(0) == 7) && (this.data.readUInt8(1) == 2) ) {
			return this.data.readUInt16LE(5) / 10
		}else{
			throw new Error('invalid message type')
		}
	}
};
