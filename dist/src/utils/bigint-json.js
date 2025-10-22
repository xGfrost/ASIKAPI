/* Konversi BigInt ke string saat JSON.stringify dipanggil */
if (!BigInt.prototype.toJSON) {
    BigInt.prototype.toJSON = function () {
        return this.toString();
    };
}
export {};
