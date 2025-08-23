const { Sequelize } = require('sequelize');
require('dotenv').config();

// 创建Sequelize实例
const sequelize = new Sequelize(
    process.env.DB_NAME || 'discord_music_bot',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || '',
    {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        dialect: process.env.DB_DIALECT || 'mysql',
        logging: false, // 设置为 console.log 来查看SQL查询
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        define: {
            timestamps: true,
            underscored: true
        }
    }
);

// 测试数据库连接
async function testConnection() {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connection successful');
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
}

// 初始化数据库（创建表）
async function initializeDatabase() {
    try {
        // 同步所有模型到数据库
        await sequelize.sync({ alter: true });
        console.log('✅ Database tables synchronized successfully');
        return true;
    } catch (error) {
        console.error('❌ Database table synchronization failed:', error.message);
        return false;
    }
}

// 关闭数据库连接
async function closeConnection() {
    try {
        await sequelize.close();
        console.log('✅ Database connection closed');
    } catch (error) {
        console.error('❌ Error closing database connection:', error.message);
    }
}

module.exports = {
    sequelize,
    testConnection,
    initializeDatabase,
    closeConnection
};