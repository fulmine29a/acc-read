module.exports.Message = class Message{
	constructor(){
		this.data = Buffer.alloc(24, 0);
		this.MSG_LEN = 24;
	}
	
	static createMessage(arr){
		let msg = new Message();

		msg.data.fill(Buffer.from(arr), 0, arr.length);
		msg.data[msg.MSG_LEN - 1] = msg.calcChecksum();

		return msg;
	}

	static parseRecived(buff){
		let msg = new Message();

		msg.data.fill(buff);
		if(msg.calcChecksum() != msg.data[msg.MSG_LEN - 1]) {
			//throw new Error('bad message checksum');
			console.error('bad checksum')
		}

		return msg;
	}

	calcChecksum(){
		let sum = 0;

		for(let i = 0; i < this.MSG_LEN - 1; i++){
			sum+=this.data[i];
		}

		return sum;
	}

	getData(){
		return this.data;
	}
};
