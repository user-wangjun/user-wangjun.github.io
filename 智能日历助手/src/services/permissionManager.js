/**
 * 权限管理服务
 * 统一管理浏览器权限申请、状态查询和持久化
 */

const STORAGE_KEY = 'app_permissions';
const LOG_STORAGE_KEY = 'app_permission_logs';
const MAX_LOG_ENTRIES = 100;

/**
 * 权限申请配置
 */
const PERMISSION_CONFIG = {
  // 最小申请间隔（毫秒），默认7天
  minRequestInterval: 7 * 24 * 60 * 60 * 1000,
  // 最大申请次数
  maxRequestCount: 3,
  // 拒绝后冷却期（毫秒），默认30天
  deniedCooldownPeriod: 30 * 24 * 60 * 60 * 1000
};

/**
 * 权限类型定义
 */
const PERMISSION_TYPES = {
  notifications: {
    name: '通知权限',
    description: '用于发送日程提醒和重要通知',
    icon: '🔔',
    required: true,
    apiName: 'notifications'
  },
  geolocation: {
    name: '地理位置权限',
    description: '用于获取当地天气信息和位置相关服务',
    icon: '📍',
    required: false,
    apiName: 'geolocation'
  },
  camera: {
    name: '摄像头权限',
    description: '用于扫描二维码和视频通话功能',
    icon: '📷',
    required: false,
    apiName: 'camera'
  },
  microphone: {
    name: '麦克风权限',
    description: '用于语音输入和语音通话功能',
    icon: '🎤',
    required: false,
    apiName: 'microphone'
  }
};

class PermissionManager {
  constructor () {
    this.permissions = {};
    this.listeners = new Map();
    this.initialized = false;
    this.permissionLogs = [];
  }

  /**
   * 初始化权限管理器
   */
  async initialize () {
    if (this.initialized) return;

    // 从本地存储加载权限状态
    this.loadFromStorage();

    // 加载权限日志
    this.loadLogs();

    // 检查浏览器实际权限状态
    await this.syncWithBrowser();

    this.initialized = true;
    console.log('🔐 权限管理器已初始化', this.permissions);
  }

  /**
   * 从本地存储加载权限状态
   */
  loadFromStorage () {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        this.permissions = data.permissions || {};
        this.firstVisitDate = data.firstVisitDate;
        this.permissionsRequested = data.permissionsRequested || false;
        console.log('📥 已加载权限状态:', this.permissions);
      } else {
        // 首次访问
        this.firstVisitDate = new Date().toISOString();
        this.permissionsRequested = false;
        this.permissions = {};
        console.log('🆕 首次访问，初始化权限状态');
      }
    } catch (error) {
      console.error('加载权限状态失败:', error);
      this.permissions = {};
    }
  }

  /**
   * 保存权限状态到本地存储
   */
  saveToStorage () {
    try {
      const data = {
        firstVisitDate: this.firstVisitDate,
        permissionsRequested: this.permissionsRequested,
        permissions: this.permissions,
        lastChecked: new Date().toISOString()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      console.log('💾 权限状态已保存');
    } catch (error) {
      console.error('保存权限状态失败:', error);
    }
  }

  /**
   * 加载权限日志
   */
  loadLogs () {
    try {
      const saved = localStorage.getItem(LOG_STORAGE_KEY);
      if (saved) {
        this.permissionLogs = JSON.parse(saved);
      }
    } catch (error) {
      console.error('加载权限日志失败:', error);
      this.permissionLogs = [];
    }
  }

  /**
   * 保存权限日志
   */
  saveLogs () {
    try {
      // 只保留最近的日志
      if (this.permissionLogs.length > MAX_LOG_ENTRIES) {
        this.permissionLogs = this.permissionLogs.slice(-MAX_LOG_ENTRIES);
      }
      localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(this.permissionLogs));
    } catch (error) {
      console.error('保存权限日志失败:', error);
    }
  }

  /**
   * 记录权限操作日志
   */
  logPermissionAction (type, action, result, details = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type,
      action,
      result,
      details,
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    this.permissionLogs.push(logEntry);
    this.saveLogs();

    console.log(`📝 权限日志: [${type}] ${action} -> ${result}`, details);
    return logEntry;
  }

  /**
   * 获取权限日志
   */
  getPermissionLogs (filter = {}) {
    let logs = [...this.permissionLogs];

    if (filter.type) {
      logs = logs.filter(l => l.type === filter.type);
    }
    if (filter.action) {
      logs = logs.filter(l => l.action === filter.action);
    }
    if (filter.result) {
      logs = logs.filter(l => l.result === filter.result);
    }

    return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  /**
   * 检查是否应该申请权限（频率限制）
   */
  shouldRequestPermission (type) {
    const config = PERMISSION_TYPES[type];
    if (!config) return false;

    const permData = this.permissions[type] || {};
    const currentStatus = permData.status;

    // 已授权，不需要再申请
    if (currentStatus === 'granted') {
      return { should: false, reason: 'already_granted' };
    }

    // 不支持，无法申请
    if (currentStatus === 'unsupported') {
      return { should: false, reason: 'unsupported' };
    }

    const now = Date.now();
    const requestCount = permData.requestCount || 0;
    const lastRequestedAt = permData.lastRequestedAt ? new Date(permData.lastRequestedAt).getTime() : 0;
    const deniedAt = permData.deniedAt ? new Date(permData.deniedAt).getTime() : 0;

    // 如果已拒绝，检查冷却期
    if (currentStatus === 'denied') {
      const timeSinceDenied = now - deniedAt;
      if (timeSinceDenied < PERMISSION_CONFIG.deniedCooldownPeriod) {
        const remainingDays = Math.ceil((PERMISSION_CONFIG.deniedCooldownPeriod - timeSinceDenied) / (24 * 60 * 60 * 1000));
        return {
          should: false,
          reason: 'denied_in_cooldown',
          remainingDays,
          message: `权限被拒绝，${remainingDays}天后可再次申请`
        };
      }
    }

    // 检查申请次数
    if (requestCount >= PERMISSION_CONFIG.maxRequestCount) {
      return {
        should: false,
        reason: 'max_requests_reached',
        message: '已达到最大申请次数，请在浏览器设置中手动开启'
      };
    }

    // 检查申请间隔
    const timeSinceLastRequest = now - lastRequestedAt;
    if (lastRequestedAt > 0 && timeSinceLastRequest < PERMISSION_CONFIG.minRequestInterval) {
      const remainingDays = Math.ceil((PERMISSION_CONFIG.minRequestInterval - timeSinceLastRequest) / (24 * 60 * 60 * 1000));
      return {
        should: false,
        reason: 'too_frequent',
        remainingDays,
        message: `申请过于频繁，${remainingDays}天后可再次申请`
      };
    }

    return {
      should: true,
      requestCount,
      remainingRequests: PERMISSION_CONFIG.maxRequestCount - requestCount
    };
  }

  /**
   * 与浏览器实际权限状态同步
   */
  async syncWithBrowser () {
    for (const [type] of Object.entries(PERMISSION_TYPES)) {
      try {
        const browserStatus = await this.queryBrowserPermission(type);
        if (this.permissions[type]) {
          // 检测权限状态变化
          if (this.permissions[type].status !== browserStatus) {
            console.log(`📋 权限状态变更 [${type}]: ${this.permissions[type].status} -> ${browserStatus}`);
            this.emit('permissionChanged', { type, oldStatus: this.permissions[type].status, newStatus: browserStatus });
            this.logPermissionAction(type, 'status_changed', browserStatus, {
              oldStatus: this.permissions[type].status
            });
          }
        }
        this.permissions[type] = {
          ...this.permissions[type],
          status: browserStatus,
          lastChecked: new Date().toISOString()
        };
      } catch (error) {
        console.warn(`查询权限状态失败 [${type}]:`, error);
      }
    }
    this.saveToStorage();
  }

  /**
   * 查询浏览器权限状态
   */
  async queryBrowserPermission (type) {
    // 尝试使用 Permissions API
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const result = await navigator.permissions.query({ name: type });
        return result.state; // 'granted', 'denied', 'prompt'
      } catch (error) {
        // 某些浏览器不支持特定权限类型的查询
        console.warn(`Permissions API 不支持 [${type}]:`, error);
      }
    }

    // 回退方案：根据权限类型使用不同的检测方法
    switch (type) {
      case 'notifications':
        if (!('Notification' in window)) return 'unsupported';
        return Notification.permission;

      case 'geolocation':
        if (!navigator.geolocation) return 'unsupported';
        // 无法直接查询，返回存储的状态或 prompt
        return this.permissions[type]?.status || 'prompt';

      case 'camera':
      case 'microphone':
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          return 'unsupported';
        }
        return this.permissions[type]?.status || 'prompt';

      default:
        return 'unknown';
    }
  }

  /**
   * 请求单个权限
   */
  async requestPermission (type, force = false) {
    const config = PERMISSION_TYPES[type];
    if (!config) {
      throw new Error(`未知的权限类型: ${type}`);
    }

    // 检查是否已授权
    const currentStatus = await this.queryBrowserPermission(type);
    if (currentStatus === 'granted') {
      console.log(`✅ 权限已授予 [${type}]`);
      this.logPermissionAction(type, 'request', 'already_granted');
      return { granted: true, status: 'granted' };
    }

    // 如果已拒绝，无法再次请求（浏览器限制）
    if (currentStatus === 'denied') {
      console.log(`❌ 权限已被拒绝 [${type}]`);
      this.logPermissionAction(type, 'request', 'denied_by_browser');
      return { granted: false, status: 'denied', reason: '用户已拒绝，需要在浏览器设置中手动开启' };
    }

    // 检查频率限制（除非强制请求）
    if (!force) {
      const checkResult = this.shouldRequestPermission(type);
      if (!checkResult.should) {
        this.logPermissionAction(type, 'request_blocked', checkResult.reason, checkResult);
        return { granted: false, status: 'blocked', ...checkResult };
      }
    }

    // 记录申请开始
    this.logPermissionAction(type, 'request_started', 'pending');

    // 请求权限
    try {
      let result;

      switch (type) {
        case 'notifications':
          result = await this.requestNotificationPermission();
          break;

        case 'geolocation':
          result = await this.requestGeolocationPermission();
          break;

        case 'camera':
          result = await this.requestMediaPermission('camera');
          break;

        case 'microphone':
          result = await this.requestMediaPermission('microphone');
          break;

        default:
          result = { granted: false, status: 'unsupported' };
      }

      // 更新权限状态
      const now = new Date().toISOString();
      this.permissions[type] = {
        ...this.permissions[type],
        status: result.status,
        granted: result.granted,
        requestCount: (this.permissions[type]?.requestCount || 0) + 1,
        lastRequestedAt: now,
        deniedAt: result.status === 'denied' ? now : this.permissions[type]?.deniedAt
      };
      this.saveToStorage();

      // 记录结果
      this.logPermissionAction(type, 'request_completed', result.status, result);
      this.emit('permissionRequested', { type, result });

      return result;
    } catch (error) {
      console.error(`请求权限失败 [${type}]:`, error);
      this.logPermissionAction(type, 'request_error', 'error', { error: error.message });
      return { granted: false, status: 'error', error: error.message };
    }
  }

  /**
   * 请求通知权限
   */
  async requestNotificationPermission () {
    if (!('Notification' in window)) {
      return { granted: false, status: 'unsupported' };
    }

    const permission = await Notification.requestPermission();
    return {
      granted: permission === 'granted',
      status: permission
    };
  }

  /**
   * 请求地理位置权限
   */
  async requestGeolocationPermission () {
    if (!navigator.geolocation) {
      return { granted: false, status: 'unsupported' };
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve({ granted: true, status: 'granted' }),
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            resolve({ granted: false, status: 'denied' });
          } else {
            resolve({ granted: false, status: 'error', error: error.message });
          }
        },
        { timeout: 10000, enableHighAccuracy: false }
      );
    });
  }

  /**
   * 请求媒体设备权限（摄像头/麦克风）
   */
  async requestMediaPermission (type) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return { granted: false, status: 'unsupported' };
    }

    const constraints = type === 'camera'
      ? { video: true }
      : { audio: true };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      // 立即停止流，我们只需要权限
      stream.getTracks().forEach(track => track.stop());
      return { granted: true, status: 'granted' };
    } catch (error) {
      if (error.name === 'NotAllowedError') {
        return { granted: false, status: 'denied' };
      }
      return { granted: false, status: 'error', error: error.message };
    }
  }

  /**
   * 请求所有必要权限
   */
  async requestAllPermissions (options = {}) {
    const { skipOptional = false, skipDenied = true, force = false } = options;
    const results = {};

    for (const [type, config] of Object.entries(PERMISSION_TYPES)) {
      // 跳过可选权限
      if (skipOptional && !config.required) {
        continue;
      }

      // 跳过已拒绝的权限（除非强制）
      if (!force && skipDenied && this.permissions[type]?.status === 'denied') {
        results[type] = { granted: false, status: 'denied', skipped: true };
        continue;
      }

      // 跳过已授权的权限
      if (this.permissions[type]?.status === 'granted') {
        results[type] = { granted: true, status: 'granted', skipped: true };
        continue;
      }

      results[type] = await this.requestPermission(type, force);
    }

    this.permissionsRequested = true;
    this.saveToStorage();

    return results;
  }

  /**
   * 检查是否首次访问
   */
  isFirstVisit () {
    return !this.permissionsRequested;
  }

  /**
   * 检查是否需要显示权限请求（智能触发）
   * 只在首次使用时显示一次，之后不再显示
   */
  shouldShowPermissionRequest () {
    // 首次访问，需要显示
    if (this.isFirstVisit()) {
      return { should: true, reason: 'first_visit' };
    }

    // 非首次访问，无论权限状态如何都不再显示
    // 用户可以在设置中手动配置权限
    return { should: false, reason: 'already_shown_once' };
  }

  /**
   * 获取权限状态
   */
  getPermissionStatus (type) {
    return this.permissions[type]?.status || 'unknown';
  }

  /**
   * 获取所有权限状态
   */
  getAllPermissionsStatus () {
    const status = {};
    for (const type of Object.keys(PERMISSION_TYPES)) {
      status[type] = {
        ...PERMISSION_TYPES[type],
        ...this.permissions[type],
        currentStatus: this.permissions[type]?.status || 'unknown'
      };
    }
    return status;
  }

  /**
   * 检查必要权限是否已授予
   */
  areRequiredPermissionsGranted () {
    for (const [type, config] of Object.entries(PERMISSION_TYPES)) {
      if (config.required) {
        const status = this.permissions[type]?.status;
        if (status !== 'granted') {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * 获取权限类型配置
   */
  getPermissionTypes () {
    return PERMISSION_TYPES;
  }

  /**
   * 获取权限配置
   */
  getPermissionConfig () {
    return PERMISSION_CONFIG;
  }

  /**
   * 添加事件监听器
   */
  on (event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * 移除事件监听器
   */
  off (event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * 触发事件
   */
  emit (event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`权限事件回调错误 [${event}]:`, error);
        }
      });
    }
  }

  /**
   * 重置权限状态（用于测试或调试）
   */
  reset () {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LOG_STORAGE_KEY);
    this.permissions = {};
    this.permissionLogs = [];
    this.permissionsRequested = false;
    this.firstVisitDate = new Date().toISOString();
    console.log('🔄 权限状态已重置');
  }
}

// 创建单例实例
export const permissionManager = new PermissionManager();
export { PERMISSION_TYPES, PERMISSION_CONFIG };
export default PermissionManager;
