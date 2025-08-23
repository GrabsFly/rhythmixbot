const { sequelize } = require('../database');
const { DataTypes } = require('sequelize');

// 定义用户模型
const User = sequelize.define('User', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
        comment: 'Discord用户ID'
    },
    username: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '用户名'
    },
    discriminator: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '用户标识符'
    },
    avatar: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '头像URL'
    },
    email: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '邮箱地址'
    },
    access_token: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'OAuth访问令牌'
    },
    refresh_token: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'OAuth刷新令牌'
    },
    token_expires_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '令牌过期时间'
    },
    last_login: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '最后登录时间'
    }
}, {
    tableName: 'users',
    comment: '用户表'
});

// 定义服务器模型
const Guild = sequelize.define('Guild', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
        comment: 'Discord服务器ID'
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '服务器名称'
    },
    icon: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '服务器图标URL'
    },
    owner_id: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '服务器所有者ID'
    },
    member_count: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '成员数量'
    }
}, {
    tableName: 'guilds',
    comment: '服务器表'
});

// 定义服务器设置模型
const GuildSettings = sequelize.define('GuildSettings', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    guild_id: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'Discord服务器ID'
    },
    now_playing_channel_id: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '正在播放消息的频道ID'
    },
    default_volume: {
        type: DataTypes.INTEGER,
        defaultValue: 50,
        comment: '默认音量'
    },
    max_queue_size: {
        type: DataTypes.INTEGER,
        defaultValue: 100,
        comment: '最大队列长度'
    },
    auto_leave: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: '自动离开语音频道'
    },
    auto_leave_timeout: {
        type: DataTypes.INTEGER,
        defaultValue: 300,
        comment: '自动离开超时时间（秒）'
    },
    dj_role_id: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'DJ角色ID'
    },
    prefix: {
        type: DataTypes.STRING,
        defaultValue: '!',
        comment: '命令前缀'
    },
    settings_json: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '其他设置的JSON字符串'
    }
}, {
    tableName: 'guild_settings',
    comment: '服务器设置表'
});

// 定义用户会话模型
const UserSession = sequelize.define('UserSession', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
        comment: '会话ID'
    },
    user_id: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Discord用户ID'
    },
    session_data: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '会话数据JSON'
    },
    expires_at: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: '会话过期时间'
    },
    ip_address: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'IP地址'
    },
    user_agent: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '用户代理'
    }
}, {
    tableName: 'user_sessions',
    comment: '用户会话表'
});

// 定义播放历史模型
const PlayHistory = sequelize.define('PlayHistory', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    guild_id: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Discord服务器ID'
    },
    user_id: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '请求用户ID'
    },
    track_title: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '歌曲标题'
    },
    track_author: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '歌曲作者'
    },
    track_url: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '歌曲URL'
    },
    track_duration: {
        type: DataTypes.BIGINT,
        allowNull: true,
        comment: '歌曲时长（毫秒）'
    },
    played_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        comment: '播放时间'
    },
    platform: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '播放平台（YouTube, Spotify等）'
    }
}, {
    tableName: 'play_history',
    comment: '播放历史表'
});

// 定义关联关系
User.hasMany(UserSession, { foreignKey: 'user_id' });
UserSession.belongsTo(User, { foreignKey: 'user_id' });

Guild.hasOne(GuildSettings, { foreignKey: 'guild_id' });
GuildSettings.belongsTo(Guild, { foreignKey: 'guild_id' });

Guild.hasMany(PlayHistory, { foreignKey: 'guild_id' });
PlayHistory.belongsTo(Guild, { foreignKey: 'guild_id' });

User.hasMany(PlayHistory, { foreignKey: 'user_id' });
PlayHistory.belongsTo(User, { foreignKey: 'user_id' });

module.exports = {
    User,
    Guild,
    GuildSettings,
    UserSession,
    PlayHistory,
    sequelize
};