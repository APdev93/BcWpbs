const {
	default: makeWASocket,
	makeCacheableSignalKeyStore,
	PHONENUMBER_MCC,
	useMultiFileAuthState,
	fetchLatestBaileysVersion,
	DisconnectReason,
} = require("@whiskeysockets/baileys");
const NodeCache = require("node-cache");
const readline = require("readline");
const fs = require("fs");
const pino = require("pino");

const msgRetryCounterCache = new NodeCache();

const useStore = false; // Untuk menyimpan semua data dari bot, contoh: nomer chat grup dll, Atur false saja, karna ini membuat bot berat

const MAIN_LOGGER = pino({
	timestamp: () => `,"time":"${new Date().toJSON()}"`,
});

const logger = MAIN_LOGGER.child({});
logger.level = "trace";

const store = useStore ? makeInMemoryStore({ logger }) : undefined;
store?.readFromFile(`${root}/database/store.json`);

setInterval(
	() => {
		store?.writeToFile(`${root}/database/store.json`);
	},
	1000 * 60 * 24 * 30,
);

/* menggunakan readline sementara */
const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});
const question = text => new Promise(resolve => rl.question(text, resolve));

/* fungsi ini untuk menghilangkan logger dari store */
const P = require("pino")({
	level: "silent",
});


async function startBotSrv(chatMessage, number, delay) {
	console.log("starting bot server...");
	const startBot = async () => {
		let { state, saveCreds } = await useMultiFileAuthState(sessionName);
		let { version } = await fetchLatestBaileysVersion();
		const conn = makeWaSocket({
			version,
			logger: P,
			printQRInTerminal: !usePairingCode,
			mobile: useMobile,
			browser: ["chrome (linux)", "", ""],
			auth: {
				creds: state.creds,
				keys: makeCacheableSignalKeyStore(state.keys, P),
			},
			msgRetryCounterCache,
		});
		store?.bind(conn.ev);
		conn.ev.on("creds.update", saveCreds);

		conn.ev.on("connection.update", async update => {
			const { connection, lastDisconnect } = update;

			if (lastDisconnect == "undefined") {
				console.log("tidak bisa terkoneksi, silahkan koneksikan ulang!");
			}
			if (connection === "connecting") {
				console.log("Menghubungkan ke sockets");
			} else if (connection === "open") {
				console.log("Terhubung ke sockets");

				const nomorWhatsApp = number.map(nomor => nomor + "@s.whatsapp.net");

				//fungsi untuk mengirim broadcast dengan delay
				function sendText(nomer, message, delay) {
					let index = 1;
					setInterval(() => {
						if (index <= nomer.length) {
							conn.sendMessage(nomer[index - 1], { text: message }); // Adjusted index
							console.log(`Kirim pesan berhasil ke : ${nomer[index - 1]}`);
							index++;
						}
					}, delay);
				}

				sendText(nomorWhatsApp, chatMessage, delay);

				let socketTimeout = delay * nomorWhatsApp.length + 5000;
				// penutupan koneksi ketika broadcast selesai agar menghindari resiko banned
				setTimeout(
					() => {
						console.log("koneksi akan di tutup untuk menghindari resiko banned");
					},
					delay * nomorWhatsApp.length + 1000,
				);
				setTimeout(function () {
					conn.end();
				}, socketTimeout);
			} else if (connection === "close") {
				console.log("socket close");
				conn.end();
			}
		});
	};
	startBot();
}
// startBotSrv("msg", ["62xx@s.whatsapp.net","62xx@s.whatsapp.net","62xx@s.whatsapp.net"], 3000);
