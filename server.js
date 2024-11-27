const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const app = express();

// Configurações do Express
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuração de CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Content-Type', 'application/json');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

// Estado do WhatsApp
let whatsappConnected = false;

// Cliente WhatsApp
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ],
        headless: true
    }
});

// Eventos do WhatsApp
client.on('qr', (qr) => {
    console.log('QR Code recebido:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    whatsappConnected = true;
    console.log('WhatsApp conectado e pronto!');
});

client.on('disconnected', () => {
    whatsappConnected = false;
    console.log('WhatsApp desconectado!');
    // Tentar reconectar
    setTimeout(() => {
        client.initialize().catch(console.error);
    }, 5000);
});

// Rota para enviar mensagem
app.post('/enviar-mensagem', async (req, res) => {
    try {
        console.log('Corpo da requisição:', JSON.stringify(req.body, null, 2));

        if (!whatsappConnected) {
            console.log('WhatsApp não está conectado');
            return res.status(503).json({
                success: false,
                error: 'WhatsApp não está conectado'
            });
        }

        const { groupId, mensagem } = req.body;

        if (!groupId || !mensagem) {
            console.log('Campos obrigatórios faltando');
            return res.status(400).json({
                success: false,
                error: 'groupId e mensagem são obrigatórios'
            });
        }

        console.log('Tentando enviar mensagem para:', groupId);

        const chat = await client.getChatById(groupId).catch(err => {
            console.error('Erro ao buscar chat:', err);
            return null;
        });

        if (!chat) {
            console.log('Grupo não encontrado:', groupId);
            return res.status(404).json({
                success: false,
                error: 'Grupo não encontrado'
            });
        }

        await chat.sendMessage(mensagem);
        console.log('Mensagem enviada com sucesso para:', groupId);

        res.json({
            success: true,
            message: 'Mensagem enviada com sucesso'
        });
    } catch (error) {
        console.error('Erro detalhado:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        
        res.status(500).json({
            success: false,
            error: error.message,
            errorType: error.name
        });
    }
});

// Rota de teste de conexão
app.get('/teste-conexao', (req, res) => {
    res.json({
        success: true,
        whatsappStatus: whatsappConnected ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

// Inicialização
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    client.initialize().catch(err => {
        console.error('Erro ao inicializar o WhatsApp:', err);
    });
});

// Tratamento de erros não capturados
process.on('unhandledRejection', (error) => {
    console.error('Erro não tratado:', error);
});