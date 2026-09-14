const os = require('node:os')

const originalUserInfo = os.userInfo
os.userInfo = options => {
  try {
    return originalUserInfo(options)
  } catch {
    return {
      uid: -1,
      gid: -1,
      username: process.env.USERNAME || 'codex',
      homedir: process.env.USERPROFILE || process.cwd(),
      shell: null
    }
  }
}
