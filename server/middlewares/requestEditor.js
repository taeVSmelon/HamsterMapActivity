const removeSecretKey = (req, res, next) => {
    const originalJson = res.json;

    res.json = function (data) {
        const cleanData1 = removeUnderscoreKeys(JSON.parse(JSON.stringify(data)));
        const cleanData2 = removeSecurityKeys(cleanData1);
        return originalJson.call(this, cleanData2);
    };

    next();
};

function removeUnderscoreKeys(obj) {
    if (Array.isArray(obj)) {
        return obj.map(removeUnderscoreKeys);
    }

    if (obj && typeof obj === "object") {
        const cleaned = {};
        for (const key in obj) {
            if (!key.startsWith("_")) {
                cleaned[key] = removeUnderscoreKeys(obj[key]);
            }
        }
        return cleaned;
    }

    return obj;
}

function removeSecurityKeys(obj) {
    if (Array.isArray(obj)) {
        return obj.map(removeSecurityKeys);
    }

    if (obj && typeof obj === "object") {
        const cleaned = {};
        for (const key in obj) {
            if (key.toLowerCase() !== "password") {
                cleaned[key] = removeSecurityKeys(obj[key]);
            }
        }
        return cleaned;
    }

    return obj;
}

const showRequestLog = (req, res, next) => {
    if (req.path.startsWith('/.well-known')) return next();
    
    const currentTime = new Date().toISOString();
    const method = req.method;
    const path = req.originalUrl;
    const ip = req.ip || req.socket.remoteAddress;

    console.log(`${currentTime} - ${ip} - ${method} - ${path}`);

    next();
};

export { removeSecretKey, showRequestLog };