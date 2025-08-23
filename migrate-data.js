const fs = require('fs');
const path = require('path');
const { testConnection, initializeDatabase } = require('./database');
const { GuildSettings, Guild } = require('./models');

// 迁移现有JSON数据到数据库
async function migrateGuildSettings() {
    const settingsFile = path.join(__dirname, 'guild-settings.json');
    
    try {
        // 检查JSON文件是否存在
        if (!fs.existsSync(settingsFile)) {
            console.log('ℹ️ 没有找到现有的guild-settings.json文件，跳过迁移');
            return true;
        }
        
        // 读取现有JSON数据
        const jsonData = fs.readFileSync(settingsFile, 'utf8');
        const settings = JSON.parse(jsonData);
        
        console.log('📦 开始迁移服务器设置数据...');
        
        let migratedCount = 0;
        let skippedCount = 0;
        
        // 遍历每个服务器的设置
        for (const [guildId, guildSettings] of Object.entries(settings)) {
            try {
                // 首先确保Guild记录存在
                const [guild, guildCreated] = await Guild.findOrCreate({
                    where: { id: guildId },
                    defaults: {
                        id: guildId,
                        name: `Guild ${guildId}`, // 默认名称，实际使用时会被更新
                        icon: null,
                        owner_id: null,
                        member_count: 0,
                        is_active: true
                    }
                });
                
                if (guildCreated) {
                    console.log(`✅ 创建了新的Guild记录: ${guildId}`);
                }
                
                // 检查是否已经存在
                const existingSetting = await GuildSettings.findOne({
                    where: { guild_id: guildId }
                });
                
                if (existingSetting) {
                    console.log(`⏭️ 服务器 ${guildId} 的设置已存在，跳过`);
                    skippedCount++;
                    continue;
                }
                
                // 创建新的设置记录
                const newSettings = {
                    guild_id: guildId,
                    now_playing_channel_id: guildSettings.nowPlayingChannelId || null,
                    default_volume: guildSettings.defaultVolume || 50,
                    max_queue_size: guildSettings.maxQueueSize || 100,
                    auto_leave: guildSettings.autoLeave !== undefined ? guildSettings.autoLeave : true,
                    auto_leave_timeout: guildSettings.autoLeaveTimeout || 300,
                    dj_role_id: guildSettings.djRoleId || null,
                    prefix: guildSettings.prefix || '!',
                    settings_json: JSON.stringify(guildSettings)
                };
                
                await GuildSettings.create(newSettings);
                console.log(`✅ 成功迁移服务器 ${guildId} 的设置`);
                migratedCount++;
                
            } catch (error) {
                console.error(`❌ 迁移服务器 ${guildId} 设置时出错:`, error.message);
            }
        }
        
        console.log(`📊 迁移完成: ${migratedCount} 个新记录，${skippedCount} 个跳过`);
        
        // 创建JSON文件的备份
        const backupFile = path.join(__dirname, `guild-settings.json.backup.${Date.now()}`);
        fs.copyFileSync(settingsFile, backupFile);
        console.log(`💾 原JSON文件已备份到: ${backupFile}`);
        
        return true;
        
    } catch (error) {
        console.error('❌ 迁移过程中出错:', error.message);
        return false;
    }
}

// 主迁移函数
async function runMigration() {
    console.log('🚀 开始数据迁移...');
    
    try {
        // 测试数据库连接
        const connected = await testConnection();
        if (!connected) {
            console.error('❌ 数据库连接失败，无法进行迁移');
            return false;
        }
        
        // 初始化数据库表
        const initialized = await initializeDatabase();
        if (!initialized) {
            console.error('❌ 数据库初始化失败，无法进行迁移');
            return false;
        }
        
        // 迁移服务器设置
        const migrated = await migrateGuildSettings();
        if (!migrated) {
            console.error('❌ 服务器设置迁移失败');
            return false;
        }
        
        console.log('🎉 数据迁移完成！');
        return true;
        
    } catch (error) {
        console.error('❌ 迁移过程中发生未知错误:', error.message);
        return false;
    }
}

// 如果直接运行此文件，执行迁移
if (require.main === module) {
    runMigration().then((success) => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = {
    runMigration,
    migrateGuildSettings
};