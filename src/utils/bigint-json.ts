/* Konversi BigInt ke string saat JSON.stringify dipanggil */
if (!(BigInt.prototype as any).toJSON) {
    (BigInt.prototype as any).toJSON = function () {
      return this.toString();
    };
  }
  export {};
  