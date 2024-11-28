const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const app = express();

let qrCodeData = null;
let whatsappConnected = false;

// Configurações do Express
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cliente WhatsApp com configurações otimizadas
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "whatsapp-api"
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--disable-gpu',
            '--no-zygote',
            '--single-process', // <- Importante
            '--disable-extensions'
        ]
    }
});

// Eventos do WhatsApp
client.on('qr', async (qr) => {
    console.log('Novo QR Code recebido');
    try {
        qrCodeData = await qrcode.toDataURL(qr, {
            errorCorrectionLevel: 'H',
            margin: 4,
            scale: 10
        });
        console.log('QR Code gerado com sucesso');
    } catch (err) {
        console.error('Erro ao gerar QR code:', err);
    }
});

client.on('ready', () => {
    console.log('Cliente WhatsApp está pronto!');
    whatsappConnected = true;
    qrCodeData = null;
});

client.on('authenticated', () => {
    console.log('WhatsApp autenticado');
    whatsappConnected = true;
    qrCodeData = null;
});

client.on('auth_failure', (err) => {
    console.error('Falha na autenticação:', err);
    whatsappConnected = false;
});

// Função para manter o serviço ativo
const keepAlive = () => {
    setInterval(() => {
        fetch('https://seu-app.onrender.com/ping')
            .catch(console.error);
    }, 840000); // 14 minutos
};

// Rota de ping
app.get('/ping', (req, res) => {
    res.send('pong');
});

// Adicionar reconexão automática
client.on('disconnected', async () => {
    console.log('Cliente desconectado. Tentando reconectar...');
    whatsappConnected = false;
    qrCodeData = null;
    
    // Tenta reconectar várias vezes
    for(let i = 0; i < 5; i++) {
        try {
            await client.initialize();
            break;
        } catch (error) {
            console.error(`Tentativa ${i+1} falhou:`, error);
            await new Promise(r => setTimeout(r, 5000));
        }
    }
});

// Rota para o QR Code
app.get('/qr', (req, res) => {
    if (whatsappConnected) {
        return res.send(`
            <html>
                <body style="display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f0f2f5;">
                    <div style="text-align: center; padding: 20px; background-color: white; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        <h2>WhatsApp já está conectado!</h2>
                    </div>
                </body>
            </html>
        `);
    }

    if (!qrCodeData) {
        return res.send(`
            <html>
                <head>
                    <meta http-equiv="refresh" content="5">
                    <style>
                        body { 
                            display: flex; 
                            justify-content: center; 
                            align-items: center; 
                            height: 100vh; 
                            margin: 0; 
                            background-color: #f0f2f5;
                            font-family: Arial, sans-serif;
                        }
                        .message {
                            text-align: center;
                            padding: 20px;
                            background-color: white;
                            border-radius: 10px;
                            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                        }
                    </style>
                </head>
                <body>
                    <div class="message">
                        <h2>Aguardando QR Code...</h2>
                        <p>A página será atualizada automaticamente.</p>
                    </div>
                </body>
            </html>
        `);
    }

    res.send(`
        <html>
            <head>
                <title>WhatsApp QR Code</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                        margin: 0;
                        background-color: #f0f2f5;
                        font-family: Arial, sans-serif;
                    }
                    .container {
                        background: white;
                        padding: 20px;
                        border-radius: 10px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                        text-align: center;
                    }
                    img {
                        max-width: 300px;
                        height: auto;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h2>Escaneie o QR Code</h2>
                    <img src="${qrCodeData}" alt="QR Code">
                    <p>Use o WhatsApp no seu celular para escanear</p>
                </div>
                <script>
                    setTimeout(() => {
                        window.location.reload();
                    }, 20000);
                </script>
            </body>
        </html>
    `);
});

// Inicialização
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    client.initialize().catch(err => {
        console.error('Erro ao inicializar o WhatsApp:', err);
    });
    keepAlive(); // Inicia o sistema de keep-alive
});

// Tratamento de erros não capturados
process.on('unhandledRejection', (error) => {
    console.error('Erro não capturado:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('Promise rejeitada não tratada:', error);
});

// Reinicialização automática em caso de erro crítico
process.on('SIGTERM', () => {
    console.log('Recebido SIGTERM. Tentando reconectar...');
    client.initialize().catch(console.error);
});

// Tratamento de erros global
process.on('uncaughtException', (error) => {
    console.error('Erro não capturado:', error);
});

// Verificação periódica do estado da conexão
setInterval(async () => {
    if (!whatsappConnected) {
        console.log('Verificação: WhatsApp desconectado. Tentando reconectar...');
        try {
            await client.initialize();
        } catch (error) {
            console.error('Erro na reconexão:', error);
        }
    }
}, 300000); // Verifica a cada 5 minutos