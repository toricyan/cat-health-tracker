/* ========================================
   🐱 にゃん健康手帳 - メインアプリケーション
   ======================================== */

// ========================================
// グローバル状態
// ========================================
const APP_STATE = {
    currentCat: 'lucky',
    currentTab: 'daily',
    cats: {
        lucky: { name: 'ラッキー', icon: '🐈' },
        mi: { name: 'ミー', icon: '🐈‍⬛' }
    }
};

// Google Apps Script WebアプリのURL
const GAS_URL = 'https://script.google.com/macros/s/AKfycbzj_KqG-IojJ5BjVzoPSV0wUXvnFUwvJQogHR1wTGNj_hNgYvhNyAwaH70UY81QOJ02UQ/exec';

// スプレッドシート連携を有効にするフラグ
const USE_SPREADSHEET = true;

// ストレージキー
const STORAGE_KEYS = {
    DAILY: 'catHealth_daily',
    TOILET: 'catHealth_toilet',
    MEDICINE: 'catHealth_medicine',
    HOSPITAL: 'catHealth_hospital',
    LABTEST: 'catHealth_labtest'
};

// ========================================
// ユーティリティ関数
// ========================================
const Utils = {
    // 今日の日付をYYYY-MM-DD形式で取得
    getTodayDate() {
        return new Date().toISOString().split('T')[0];
    },
    
    // 現在時刻をHH:MM形式で取得
    getCurrentTime() {
        const now = new Date();
        return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    },
    
    // 日時をフォーマット
    formatDateTime(dateStr, timeStr) {
        const date = new Date(dateStr);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        return `${month}/${day} ${timeStr}`;
    },
    
    // ストレージからデータを取得
    getData(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            console.error('データ読み込みエラー:', e);
            return {};
        }
    },
    
    // ストレージにデータを保存
    saveData(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('データ保存エラー:', e);
            return false;
        }
    },
    
    // トースト表示
    showToast(message = '保存しました！', icon = '✅') {
        const toast = document.getElementById('toast');
        toast.querySelector('.toast-message').textContent = message;
        toast.querySelector('.toast-icon').textContent = icon;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2500);
    },
    
    // ローディング表示
    showLoading(message = '読み込み中...') {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.querySelector('.loading-text').textContent = message;
            loading.classList.add('show');
        }
    },
    
    // ローディング非表示
    hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.classList.remove('show');
        }
    },
    
    // 一意のIDを生成
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
};

// ========================================
// データ管理クラス
// ========================================
class DataManager {
    constructor() {
        this.dailyData = Utils.getData(STORAGE_KEYS.DAILY);
        this.toiletData = Utils.getData(STORAGE_KEYS.TOILET);
        this.medicineData = Utils.getData(STORAGE_KEYS.MEDICINE);
        this.hospitalData = Utils.getData(STORAGE_KEYS.HOSPITAL);
        this.labtestData = Utils.getData(STORAGE_KEYS.LABTEST);
    }
    
    // キーを生成（猫ID_日付）
    getKey(date, catId = APP_STATE.currentCat) {
        return `${catId}_${date}`;
    }
    
    // スプレッドシートにPOSTリクエストを送信
    async postToSpreadsheet(data) {
        if (!USE_SPREADSHEET || !GAS_URL) return { success: false };
        
        try {
            const response = await fetch(GAS_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            return { success: true };
        } catch (error) {
            console.error('スプレッドシート連携エラー:', error);
            return { success: false, error };
        }
    }
    
    // 日次データを保存
    saveDailyRecord(date, record) {
        const key = this.getKey(date);
        this.dailyData[key] = {
            ...record,
            cat: APP_STATE.currentCat,
            date: date,
            updatedAt: new Date().toISOString()
        };
        Utils.saveData(STORAGE_KEYS.DAILY, this.dailyData);
        
        // スプレッドシートにも保存
        this.postToSpreadsheet({
            action: 'saveDailyRecord',
            cat: APP_STATE.currentCat,
            date: date,
            ...record
        });
    }
    
    // 日次データを取得
    getDailyRecord(date, catId = APP_STATE.currentCat) {
        const key = this.getKey(date, catId);
        return this.dailyData[key] || null;
    }
    
    // 日次データをスプレッドシートから取得（非同期）
    async getDailyRecordFromSheet(date, catId = APP_STATE.currentCat) {
        if (!USE_SPREADSHEET || !GAS_URL) return null;
        
        try {
            const url = `${GAS_URL}?action=getDailyRecord&cat=${catId}&date=${date}`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (data && !data.error) {
                // ローカルストレージにも保存
                const key = this.getKey(date, catId);
                this.dailyData[key] = {
                    ...data,
                    cat: catId,
                    date: date
                };
                Utils.saveData(STORAGE_KEYS.DAILY, this.dailyData);
                return data;
            }
        } catch (error) {
            console.error('スプレッドシートからのデータ取得エラー:', error);
        }
        return null;
    }
    
    // 排泄記録を追加
    addToiletRecord(date, record) {
        const key = this.getKey(date);
        if (!this.toiletData[key]) {
            this.toiletData[key] = [];
        }
        
        const newRecord = {
            id: Utils.generateId(),
            ...record,
            cat: APP_STATE.currentCat,
            date: date,
            createdAt: new Date().toISOString()
        };
        
        this.toiletData[key].push(newRecord);
        // 時刻順にソート
        this.toiletData[key].sort((a, b) => a.time.localeCompare(b.time));
        Utils.saveData(STORAGE_KEYS.TOILET, this.toiletData);
        
        // スプレッドシートにも保存
        this.postToSpreadsheet({
            action: 'addToiletRecord',
            cat: APP_STATE.currentCat,
            date: date,
            ...record
        });
        
        // 日次記録の排泄回数を自動更新
        this.updateDailyToiletCount(date);
        
        return newRecord;
    }
    
    // 排泄回数を日次記録に自動反映
    updateDailyToiletCount(date) {
        const records = this.getToiletRecords(date);
        let urineCount = 0;
        let fecesCount = 0;
        
        records.forEach(r => {
            if (r.type === 'urine' || r.type === 'both') urineCount++;
            if (r.type === 'feces' || r.type === 'both') fecesCount++;
        });
        
        // 日次記録を取得または作成
        const key = this.getKey(date);
        const existing = this.dailyData[key] || {
            cat: APP_STATE.currentCat,
            date: date
        };
        
        // 排泄回数を更新
        existing.urineCount = urineCount;
        existing.fecesCount = fecesCount;
        existing.updatedAt = new Date().toISOString();
        
        this.dailyData[key] = existing;
        Utils.saveData(STORAGE_KEYS.DAILY, this.dailyData);
        
        // スプレッドシートも更新
        this.postToSpreadsheet({
            action: 'saveDailyRecord',
            cat: APP_STATE.currentCat,
            date: date,
            ...existing
        });
    }
    
    // 排泄記録を取得
    getToiletRecords(date, catId = APP_STATE.currentCat) {
        const key = this.getKey(date, catId);
        return this.toiletData[key] || [];
    }
    
    // 排泄記録をスプレッドシートから取得（非同期）
    async getToiletRecordsFromSheet(date, catId = APP_STATE.currentCat) {
        if (!USE_SPREADSHEET || !GAS_URL) return [];
        
        try {
            const url = `${GAS_URL}?action=getToiletRecords&cat=${catId}&date=${date}`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (data && !data.error && Array.isArray(data)) {
                // ローカルストレージにも保存
                const key = this.getKey(date, catId);
                this.toiletData[key] = data;
                Utils.saveData(STORAGE_KEYS.TOILET, this.toiletData);
                return data;
            }
        } catch (error) {
            console.error('スプレッドシートからの排泄データ取得エラー:', error);
        }
        return [];
    }
    
    // 排泄記録を削除
    deleteToiletRecord(date, recordId) {
        const key = this.getKey(date);
        if (this.toiletData[key]) {
            this.toiletData[key] = this.toiletData[key].filter(r => r.id !== recordId);
            Utils.saveData(STORAGE_KEYS.TOILET, this.toiletData);
            
            // 日次記録の排泄回数も自動更新
            this.updateDailyToiletCount(date);
        }
    }
    
    // 投薬記録を保存
    saveMedicineRecord(date, timing, record) {
        const key = `${this.getKey(date)}_${timing}`;
        this.medicineData[key] = {
            ...record,
            cat: APP_STATE.currentCat,
            date: date,
            timing: timing,
            updatedAt: new Date().toISOString()
        };
        Utils.saveData(STORAGE_KEYS.MEDICINE, this.medicineData);
        
        // スプレッドシートにも保存
        this.postToSpreadsheet({
            action: 'saveMedicineRecord',
            cat: APP_STATE.currentCat,
            date: date,
            timing: timing,
            ...record
        });
    }
    
    // 診察記録を保存
    saveHospitalRecord(datetime, record) {
        const id = Utils.generateId();
        this.hospitalData[id] = {
            ...record,
            cat: APP_STATE.currentCat,
            datetime: datetime,
            createdAt: new Date().toISOString()
        };
        Utils.saveData(STORAGE_KEYS.HOSPITAL, this.hospitalData);
        
        // スプレッドシートにも保存
        this.postToSpreadsheet({
            action: 'saveHospitalRecord',
            cat: APP_STATE.currentCat,
            datetime: datetime,
            ...record
        });
    }
    
    // 検査結果を保存
    saveLabtestRecord(date, record) {
        const key = this.getKey(date);
        this.labtestData[key] = {
            ...record,
            cat: APP_STATE.currentCat,
            date: date,
            updatedAt: new Date().toISOString()
        };
        Utils.saveData(STORAGE_KEYS.LABTEST, this.labtestData);
        
        // スプレッドシートにも保存
        this.postToSpreadsheet({
            action: 'saveLabtestRecord',
            cat: APP_STATE.currentCat,
            date: date,
            ...record
        });
    }
    
    // 検査結果を取得
    getLabtestRecord(date, catId = APP_STATE.currentCat) {
        const key = this.getKey(date, catId);
        return this.labtestData[key] || null;
    }
    
    // キャッシュ用オブジェクト
    dataCache = {};
    cacheExpiry = 5 * 60 * 1000; // 5分間キャッシュ
    
    // 期間のデータを取得（グラフ用・非同期）
    async getDataForPeriod(startDate, endDate, catId = APP_STATE.currentCat) {
        const cacheKey = `${catId}_${startDate}_${endDate}`;
        const now = Date.now();
        
        // キャッシュがあり、有効期限内ならキャッシュを返す
        if (this.dataCache[cacheKey] && (now - this.dataCache[cacheKey].timestamp < this.cacheExpiry)) {
            console.log('📦 キャッシュからデータ取得');
            return this.dataCache[cacheKey].data;
        }
        
        // スプレッドシートからデータを取得
        if (USE_SPREADSHEET && GAS_URL) {
            try {
                const url = `${GAS_URL}?action=getAllData&cat=${catId}&startDate=${startDate}&endDate=${endDate}`;
                const response = await fetch(url);
                const data = await response.json();
                
                if (data && !data.error && Array.isArray(data)) {
                    // キャッシュに保存
                    this.dataCache[cacheKey] = { data: data, timestamp: now };
                    console.log('🌐 スプレッドシートからデータ取得＆キャッシュ');
                    return data;
                }
            } catch (error) {
                console.error('スプレッドシートからのデータ取得エラー:', error);
            }
        }
        
        // フォールバック: ローカルストレージから取得
        return this.getDataForPeriodSync(startDate, endDate, catId);
    }
    
    // キャッシュをクリア（データ更新時に呼ぶ）
    clearCache() {
        this.dataCache = {};
        console.log('🗑️ キャッシュクリア');
    }
    
    // 期間のデータを取得（グラフ用・同期版）
    getDataForPeriodSync(startDate, endDate, catId = APP_STATE.currentCat) {
        const result = [];
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const daily = this.getDailyRecord(dateStr, catId);
            const toiletRecords = this.getToiletRecords(dateStr, catId);
            
            result.push({
                date: dateStr,
                daily: daily,
                toiletCount: {
                    urine: toiletRecords.filter(r => r.type === 'urine' || r.type === 'both').length,
                    feces: toiletRecords.filter(r => r.type === 'feces' || r.type === 'both').length
                }
            });
        }
        
        return result;
    }
    
    // 全データをエクスポート
    exportAllData() {
        return {
            daily: this.dailyData,
            toilet: this.toiletData,
            medicine: this.medicineData,
            hospital: this.hospitalData,
            exportedAt: new Date().toISOString()
        };
    }
    
    // CSVとしてエクスポート（日次データ）
    exportDailyToCSV(catId = APP_STATE.currentCat) {
        const headers = [
            '日付', '猫', '体重(kg)', '元気度', '食欲',
            '飲水量(cc)', 'カリカリ(g)', 'ウェット(g)', 'チュール(本)', 'おやつ(袋)',
            '尿回数', '便回数', '便の状態', 'メモ'
        ];
        
        const rows = Object.values(this.dailyData)
            .filter(r => r.cat === catId)
            .sort((a, b) => a.date.localeCompare(b.date))
            .map(r => [
                r.date,
                APP_STATE.cats[r.cat]?.name || r.cat,
                r.weight || '',
                r.energy || '',
                r.appetite || '',
                r.water || '',
                r.dryFood || '',
                r.wetFood || '',
                r.churu || '',
                r.treats || '',
                r.urineCount || '',
                r.fecesCount || '',
                r.fecesCondition || '',
                r.memo || ''
            ]);
        
        const csv = [headers, ...rows]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');
        
        return csv;
    }
}

// ========================================
// UIコントローラー
// ========================================
class UIController {
    constructor(dataManager) {
        this.data = dataManager;
        this.charts = {};
    }
    
    // 初期化
    init() {
        this.setupEventListeners();
        this.setDefaultDates();
        this.loadCurrentData();
        this.updateToiletList();
    }
    
    // イベントリスナーを設定
    setupEventListeners() {
        // 猫選択
        document.querySelectorAll('.cat-btn').forEach(btn => {
            btn.addEventListener('click', () => this.selectCat(btn.dataset.cat));
        });
        
        // タブ切り替え
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.selectTab(btn.dataset.tab));
        });
        
        // 日次フォーム
        document.getElementById('daily-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveDailyForm();
        });
        
        // 日付変更時にデータを読み込み
        document.getElementById('daily-date').addEventListener('change', () => {
            this.loadDailyData();
        });
        
        // 排泄クイックボタン
        document.getElementById('quick-urine').addEventListener('click', () => {
            this.quickAddToilet('urine');
        });
        document.getElementById('quick-feces').addEventListener('click', () => {
            this.quickAddToilet('feces');
        });
        document.getElementById('quick-both').addEventListener('click', () => {
            this.quickAddToilet('both');
        });
        
        // 排泄フォーム
        document.getElementById('toilet-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveToiletForm();
        });
        
        // 排泄日付変更
        document.getElementById('toilet-date').addEventListener('change', () => {
            this.updateToiletList();
        });
        
        // 投薬フォーム
        document.getElementById('medicine-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveMedicineForm();
        });
        
        // 診察フォーム
        document.getElementById('hospital-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveHospitalForm();
        });
        
        // 点滴チェック時に量入力欄を表示
        document.querySelector('input[value="drip"]').addEventListener('change', (e) => {
            document.getElementById('drip-amount-row').style.display = 
                e.target.checked ? 'flex' : 'none';
        });
        
        // 検査結果フォーム
        document.getElementById('labtest-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveLabtestForm();
        });
        
        // 検査日付変更時にデータを読み込み
        document.getElementById('labtest-date').addEventListener('change', () => {
            this.loadLabtestData();
        });
        
        // グラフ日付変更
        document.getElementById('chart-start').addEventListener('change', () => this.updateCharts());
        document.getElementById('chart-end').addEventListener('change', () => this.updateCharts());
        
        // エクスポート
        document.getElementById('export-btn').addEventListener('click', () => this.exportData());
        
        // 印刷（グラフタブをそのまま印刷）
        document.getElementById('print-btn').addEventListener('click', () => {
            window.print();
        });
    }
    
    // 猫を選択
    selectCat(catId) {
        APP_STATE.currentCat = catId;
        
        document.querySelectorAll('.cat-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.cat === catId);
        });
        
        // データを再読み込み
        this.loadCurrentData();
        this.updateToiletList();
        this.updateCharts();
    }
    
    // タブを選択
    selectTab(tabId) {
        APP_STATE.currentTab = tabId;
        
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });
        
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabId}-tab`);
        });
        
        // タブごとにデータを再読み込み
        if (tabId === 'daily') {
            this.loadDailyData();
        } else if (tabId === 'toilet') {
            this.updateToiletList();
        } else if (tabId === 'labtest') {
            this.loadLabtestData();
        } else if (tabId === 'chart') {
            this.updateCharts();
        }
    }
    
    // デフォルトの日付を設定
    setDefaultDates() {
        const today = Utils.getTodayDate();
        // グラフの開始日を11/14に設定
        const startDate = new Date('2025-11-14');
        
        document.getElementById('daily-date').value = today;
        document.getElementById('toilet-date').value = today;
        document.getElementById('medicine-date').value = today;
        document.getElementById('hospital-datetime').value = today + 'T09:00';
        document.getElementById('labtest-date').value = today;
        document.getElementById('toilet-time').value = Utils.getCurrentTime();
        
        document.getElementById('chart-start').value = startDate.toISOString().split('T')[0];
        document.getElementById('chart-end').value = today;
    }
    
    // 現在のデータを読み込み
    loadCurrentData() {
        this.loadDailyData();
    }
    
    // 日次データを読み込み
    async loadDailyData() {
        const date = document.getElementById('daily-date').value;
        let record = this.data.getDailyRecord(date);
        
        // ローカルストレージにデータがなければスプレッドシートから取得
        if (!record) {
            Utils.showLoading('データを取得中...');
            try {
                record = await this.data.getDailyRecordFromSheet(date);
            } finally {
                Utils.hideLoading();
            }
        }
        
        // 排泄データをスプレッドシートから取得して回数を計算
        let autoUrineCount = 0;
        let autoFecesCount = 0;
        
        // まずスプレッドシートから取得を試みる
        let toiletRecords = await this.data.getToiletRecordsFromSheet(date);
        if (toiletRecords.length === 0) {
            // 取得できなければローカルストレージを使用
            toiletRecords = this.data.getToiletRecords(date);
        }
        
        toiletRecords.forEach(r => {
            if (r.type === 'urine' || r.type === 'both') autoUrineCount++;
            if (r.type === 'feces' || r.type === 'both') autoFecesCount++;
        });
        
        if (record) {
            // フォームにデータを反映
            document.getElementById('weight').value = record.weight || '';
            document.getElementById('water').value = record.water || '';
            document.getElementById('dry-food').value = record.dryFood || '';
            document.getElementById('wet-food').value = record.wetFood || '';
            document.getElementById('churu').value = record.churu || '';
            document.getElementById('treats').value = record.treats || '';
            // 排泄回数は排泄タブのデータを優先
            document.getElementById('urine-count').value = autoUrineCount || record.urineCount || '';
            document.getElementById('feces-count').value = autoFecesCount || record.fecesCount || '';
            document.getElementById('daily-memo').value = record.memo || '';
            
            // ラジオボタン
            this.setRadioValue('energy', record.energy);
            this.setRadioValue('appetite', record.appetite);
            this.setRadioValue('feces-condition', record.fecesCondition);
        } else {
            // フォームをリセット
            document.getElementById('daily-form').reset();
            document.getElementById('daily-date').value = date;
            // 排泄タブのデータがあれば反映
            document.getElementById('urine-count').value = autoUrineCount || '';
            document.getElementById('feces-count').value = autoFecesCount || '';
        }
    }
    
    // ラジオボタンの値を設定
    setRadioValue(name, value) {
        const radios = document.querySelectorAll(`input[name="${name}"]`);
        radios.forEach(radio => {
            radio.checked = radio.value === value;
        });
    }
    
    // ラジオボタンの値を取得
    getRadioValue(name) {
        const checked = document.querySelector(`input[name="${name}"]:checked`);
        return checked ? checked.value : '';
    }
    
    // 日次フォームを保存
    saveDailyForm() {
        const date = document.getElementById('daily-date').value;
        const record = {
            weight: document.getElementById('weight').value,
            energy: this.getRadioValue('energy'),
            appetite: this.getRadioValue('appetite'),
            water: document.getElementById('water').value,
            dryFood: document.getElementById('dry-food').value,
            wetFood: document.getElementById('wet-food').value,
            churu: document.getElementById('churu').value,
            treats: document.getElementById('treats').value,
            urineCount: document.getElementById('urine-count').value,
            fecesCount: document.getElementById('feces-count').value,
            fecesCondition: this.getRadioValue('feces-condition'),
            memo: document.getElementById('daily-memo').value
        };
        
        this.data.saveDailyRecord(date, record);
        this.data.clearCache(); // キャッシュをクリア
        Utils.showToast('日次記録を保存しました！');
    }
    
    // クイック排泄追加
    quickAddToilet(type) {
        const date = document.getElementById('toilet-date').value;
        const time = Utils.getCurrentTime();
        
        const record = {
            time: time,
            type: type,
            amount: 'normal',
            memo: ''
        };
        
        this.data.addToiletRecord(date, record);
        this.updateToiletList();
        
        const typeLabel = type === 'urine' ? 'おしっこ' : 
                         type === 'feces' ? 'うんち' : '両方';
        Utils.showToast(`${time} ${typeLabel}を記録しました！`);
    }
    
    // 排泄フォームを保存
    saveToiletForm() {
        const date = document.getElementById('toilet-date').value;
        const time = document.getElementById('toilet-time').value;
        const type = this.getRadioValue('toilet-type');
        const amount = this.getRadioValue('toilet-amount');
        const memo = document.getElementById('toilet-memo').value;
        
        if (!time || !type) {
            Utils.showToast('時刻と種類を入力してください', '⚠️');
            return;
        }
        
        const record = {
            time: time,
            type: type,
            amount: amount,
            memo: memo
        };
        
        this.data.addToiletRecord(date, record);
        this.updateToiletList();
        
        // フォームリセット
        document.getElementById('toilet-time').value = Utils.getCurrentTime();
        document.getElementById('toilet-memo').value = '';
        document.querySelectorAll('input[name="toilet-type"]').forEach(r => r.checked = false);
        document.querySelectorAll('input[name="toilet-amount"]').forEach(r => r.checked = false);
        
        Utils.showToast('排泄記録を追加しました！');
    }
    
    // 排泄リストを更新
    async updateToiletList() {
        const date = document.getElementById('toilet-date').value;
        
        // 常にスプレッドシートから最新データを取得
        Utils.showLoading('排泄記録を取得中...');
        let records = [];
        try {
            records = await this.data.getToiletRecordsFromSheet(date);
        } catch (error) {
            console.error('排泄データ取得エラー:', error);
        } finally {
            Utils.hideLoading();
        }
        
        // スプレッドシートから取得できなければローカルを使用
        if (records.length === 0) {
            records = this.data.getToiletRecords(date);
        }
        
        const list = document.getElementById('toilet-list');
        
        if (records.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📝</div>
                    <div class="empty-state-text">まだ記録がありません</div>
                </div>
            `;
            return;
        }
        
        list.innerHTML = records.map(record => {
            const typeIcon = record.type === 'urine' ? '💧' : 
                            record.type === 'feces' ? '💩' : '💧💩';
            const amountLabel = {
                'normal': '',
                'more': '(多め)',
                'less': '(少量)',
                'drops': '(数滴)'
            }[record.amount] || '';
            
            return `
                <div class="record-item" data-id="${record.id}">
                    <span class="record-time">${record.time}</span>
                    <span class="record-type">${typeIcon}</span>
                    <span class="record-memo">${amountLabel} ${record.memo || ''}</span>
                    <button class="record-delete" onclick="ui.deleteToiletRecord('${date}', '${record.id}')">
                        ✕
                    </button>
                </div>
            `;
        }).join('');
    }
    
    // 排泄記録を削除
    deleteToiletRecord(date, recordId) {
        this.data.deleteToiletRecord(date, recordId);
        this.updateToiletList();
        Utils.showToast('記録を削除しました', '🗑️');
    }
    
    // 投薬フォームを保存
    saveMedicineForm() {
        const date = document.getElementById('medicine-date').value;
        const timing = this.getRadioValue('timing');
        
        if (!timing) {
            Utils.showToast('タイミングを選択してください', '⚠️');
            return;
        }
        
        const medicines = Array.from(document.querySelectorAll('input[name="medicine"]:checked'))
            .map(cb => cb.value);
        
        const record = {
            medicines: medicines,
            memo: document.getElementById('medicine-memo').value
        };
        
        this.data.saveMedicineRecord(date, timing, record);
        Utils.showToast('投薬記録を保存しました！');
    }
    
    // 診察フォームを保存
    saveHospitalForm() {
        const datetime = document.getElementById('hospital-datetime').value;
        
        const treatments = Array.from(document.querySelectorAll('input[name="treatment"]:checked'))
            .map(cb => cb.value);
        
        const record = {
            weight: document.getElementById('hospital-weight').value,
            treatments: treatments,
            dripAmount: treatments.includes('drip') ? document.getElementById('drip-amount').value : '',
            diagnosis: document.getElementById('diagnosis').value,
            prescription: document.getElementById('prescription').value
        };
        
        this.data.saveHospitalRecord(datetime, record);
        Utils.showToast('診察記録を保存しました！');
        
        // フォームリセット
        document.getElementById('hospital-form').reset();
        document.getElementById('hospital-datetime').value = Utils.getTodayDate() + 'T09:00';
    }
    
    // 検査結果フォームを保存
    saveLabtestForm() {
        const date = document.getElementById('labtest-date').value;
        
        const record = {
            // 血液検査
            // CBC
            wbc: document.getElementById('wbc').value,
            hct: document.getElementById('hct').value,
            plt: document.getElementById('plt').value,
            // 生化学
            glucose: document.getElementById('glucose').value,
            tp: document.getElementById('tp').value,
            alb: document.getElementById('alb').value,
            bun: document.getElementById('bun').value,
            creatinine: document.getElementById('creatinine').value,
            tbil: document.getElementById('tbil').value,
            ast: document.getElementById('ast').value,
            alt: document.getElementById('alt').value,
            alp: document.getElementById('alp').value,
            lipase: document.getElementById('lipase').value,
            cpk: document.getElementById('cpk').value,
            calcium: document.getElementById('calcium').value,
            phosphorus: document.getElementById('phosphorus').value,
            sodium: document.getElementById('sodium').value,
            potassium: document.getElementById('potassium').value,
            chloride: document.getElementById('chloride').value,
            // 尿検査（定性+定量）
            urineGlucoseQual: document.getElementById('urine-glucose-qual').value,
            urineGlucose: document.getElementById('urine-glucose').value,
            urineProteinQual: document.getElementById('urine-protein-qual').value,
            urineProtein: document.getElementById('urine-protein').value,
            urineBilirubinQual: document.getElementById('urine-bilirubin-qual').value,
            urineBilirubin: document.getElementById('urine-bilirubin').value,
            urinePh: document.getElementById('urine-ph').value,
            urineSg: document.getElementById('urine-sg').value,
            urineBloodQual: document.getElementById('urine-blood-qual').value,
            urineBlood: document.getElementById('urine-blood').value,
            urineKetoneQual: document.getElementById('urine-ketone-qual').value,
            urineKetone: document.getElementById('urine-ketone').value,
            urineNitrite: this.getRadioValue('urine-nitrite'),
            urineWbc: document.getElementById('urine-wbc').value,
            // 備考
            memo: document.getElementById('labtest-memo').value
        };
        
        this.data.saveLabtestRecord(date, record);
        Utils.showToast('検査結果を保存しました！');
    }
    
    // 検査結果データを読み込み
    loadLabtestData() {
        const date = document.getElementById('labtest-date').value;
        const record = this.data.getLabtestRecord(date);
        
        if (record) {
            // CBC
            document.getElementById('wbc').value = record.wbc || '';
            document.getElementById('hct').value = record.hct || '';
            document.getElementById('plt').value = record.plt || '';
            // 生化学
            document.getElementById('glucose').value = record.glucose || '';
            document.getElementById('tp').value = record.tp || '';
            document.getElementById('alb').value = record.alb || '';
            document.getElementById('bun').value = record.bun || '';
            document.getElementById('creatinine').value = record.creatinine || '';
            document.getElementById('tbil').value = record.tbil || '';
            document.getElementById('ast').value = record.ast || '';
            document.getElementById('alt').value = record.alt || '';
            document.getElementById('alp').value = record.alp || '';
            document.getElementById('lipase').value = record.lipase || '';
            document.getElementById('cpk').value = record.cpk || '';
            document.getElementById('calcium').value = record.calcium || '';
            document.getElementById('phosphorus').value = record.phosphorus || '';
            document.getElementById('sodium').value = record.sodium || '';
            document.getElementById('potassium').value = record.potassium || '';
            document.getElementById('chloride').value = record.chloride || '';
            // 尿検査（定性+定量）- 古いデータ形式との互換性対応
            const setUrineValue = (qualId, quantId, qualVal, quantVal) => {
                // 古いデータ形式（"negative"など）が定量値にある場合は無視
                const isNumeric = (val) => val !== null && val !== '' && !isNaN(Number(val));
                document.getElementById(qualId).value = qualVal || '';
                document.getElementById(quantId).value = isNumeric(quantVal) ? quantVal : '';
            };
            setUrineValue('urine-glucose-qual', 'urine-glucose', record.urineGlucoseQual, record.urineGlucose);
            setUrineValue('urine-protein-qual', 'urine-protein', record.urineProteinQual, record.urineProtein);
            setUrineValue('urine-bilirubin-qual', 'urine-bilirubin', record.urineBilirubinQual, record.urineBilirubin);
            document.getElementById('urine-ph').value = record.urinePh || '';
            document.getElementById('urine-sg').value = record.urineSg || '';
            setUrineValue('urine-blood-qual', 'urine-blood', record.urineBloodQual, record.urineBlood);
            setUrineValue('urine-ketone-qual', 'urine-ketone', record.urineKetoneQual, record.urineKetone);
            this.setRadioValue('urine-nitrite', record.urineNitrite);
            document.getElementById('urine-wbc').value = record.urineWbc || '';
            // 備考
            document.getElementById('labtest-memo').value = record.memo || '';
        } else {
            // フォームリセット
            document.getElementById('labtest-form').reset();
            document.getElementById('labtest-date').value = date;
        }
    }
    
    // グラフを更新
    async updateCharts() {
        const startDate = document.getElementById('chart-start').value;
        const endDate = document.getElementById('chart-end').value;
        
        if (!startDate || !endDate) return;
        
        Utils.showLoading('グラフを読み込み中...');
        
        let data;
        try {
            data = await this.data.getDataForPeriod(startDate, endDate);
        } catch (error) {
            console.error('データ取得エラー:', error);
            // エラー時はローカルストレージから取得
            data = this.data.getDataForPeriodSync(startDate, endDate);
        } finally {
            Utils.hideLoading();
        }
        
        if (!data || data.length === 0) {
            console.warn('データが取得できませんでした');
            return;
        }
        
        const labels = data.map(d => {
            const date = new Date(d.date);
            return `${date.getMonth() + 1}/${date.getDate()}`;
        });
        
        // 共通のチャートオプション
        const commonOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true
                }
            }
        };
        
        // 体重グラフ
        const weightData = data.map(d => d.daily?.weight || null).filter(v => v !== null);
        const minWeight = weightData.length > 0 ? Math.min(...weightData) - 1 : 0;
        const maxWeight = weightData.length > 0 ? Math.max(...weightData) + 0.5 : 10;
        
        this.createOrUpdateChart('weight-chart', {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    data: data.map(d => d.daily?.weight || null),
                    borderColor: '#E8927C',
                    backgroundColor: 'rgba(232, 146, 124, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 2,
                    pointBackgroundColor: '#E8927C',
                    spanGaps: true
                }]
            },
            options: {
                ...commonOptions,
                scales: {
                    ...commonOptions.scales,
                    y: { 
                        beginAtZero: false,
                        min: minWeight,
                        max: maxWeight
                    }
                }
            }
        });
        
        // 排尿回数グラフ（排泄詳細シートを優先）
        this.createOrUpdateChart('urine-chart', {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    data: data.map(d => {
                        // 排泄詳細シートのカウントを優先、なければ日次記録を使用
                        const count = d.toiletCount?.urine > 0 ? d.toiletCount.urine : d.daily?.urineCount;
                        return count > 0 ? count : null;
                    }),
                    backgroundColor: 'rgba(86, 204, 242, 0.7)',
                    borderColor: '#56CCF2',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: commonOptions
        });
        
        // 食事量グラフ（カリカリ・ウェット＝棒、チュール＝折れ線）
        this.createOrUpdateChart('food-chart', {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'カリカリ(g)',
                        data: data.map(d => {
                            const food = d.daily?.dryFood;
                            return (food && food > 0) ? food : null;
                        }),
                        backgroundColor: 'rgba(242, 201, 76, 0.8)',
                        borderColor: '#F2C94C',
                        borderWidth: 1,
                        borderRadius: 4,
                        yAxisID: 'y'
                    },
                    {
                        label: 'ウェット(g)',
                        data: data.map(d => {
                            const food = d.daily?.wetFood;
                            return (food && food > 0) ? food : null;
                        }),
                        backgroundColor: 'rgba(232, 146, 124, 0.8)',
                        borderColor: '#E8927C',
                        borderWidth: 1,
                        borderRadius: 4,
                        yAxisID: 'y'
                    },
                    {
                        label: 'チュール(本)',
                        type: 'line',
                        data: data.map(d => {
                            const churu = d.daily?.churu;
                            return (churu && churu > 0) ? churu : null;
                        }),
                        borderColor: '#7CBAAB',
                        backgroundColor: '#7CBAAB',
                        borderWidth: 2,
                        pointRadius: 2,
                        pointBackgroundColor: '#7CBAAB',
                        tension: 0.3,
                        yAxisID: 'y1',
                        spanGaps: true
                    }
                ]
            },
            options: {
                ...commonOptions,
                plugins: {
                    legend: { 
                        display: true, 
                        position: 'top',
                        labels: { boxWidth: 12, padding: 8, font: { size: 10 } }
                    }
                },
                scales: {
                    x: { grid: { display: false } },
                    y: {
                        type: 'linear',
                        position: 'left',
                        beginAtZero: true,
                        title: { display: true, text: 'g', font: { size: 10 } }
                    },
                    y1: {
                        type: 'linear',
                        position: 'right',
                        beginAtZero: true,
                        max: 5,
                        title: { display: true, text: '本', font: { size: 10 } },
                        grid: { drawOnChartArea: false }
                    }
                }
            }
        });
        
        // 飲水量グラフ（0や空は表示しない）
        const waterData = data.map(d => {
            const water = d.daily?.water;
            return (water && water > 0) ? water : null;
        });
        const validWater = waterData.filter(v => v !== null);
        const minWater = validWater.length > 0 ? Math.min(...validWater) - 50 : 0;
        
        this.createOrUpdateChart('water-chart', {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    data: waterData,
                    borderColor: '#7CBAAB',
                    backgroundColor: 'rgba(124, 186, 171, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 2,
                    pointBackgroundColor: '#7CBAAB',
                    spanGaps: true
                }]
            },
            options: {
                ...commonOptions,
                scales: {
                    ...commonOptions.scales,
                    y: { 
                        beginAtZero: false,
                        min: Math.max(0, minWater)
                    }
                }
            }
        });
        
        // 通院・点滴グラフ（全期間表示、棒がある日付だけラベル表示）
        const dripData = data.map(d => {
            const drip = d.daily?.drip;
            const dripNum = drip ? Number(drip) : 0;
            return (dripNum > 0) ? dripNum : null;
        });
        
        // 棒が立っている日付だけをラベルにする（それ以外は空文字）
        const hospitalLabels = labels.map((label, index) => {
            return dripData[index] !== null ? label : '';
        });
        
        this.createOrUpdateChart('hospital-chart', {
            type: 'bar',
            data: {
                labels: hospitalLabels,
                datasets: [{
                    label: '点滴(cc)',
                    data: dripData,
                    backgroundColor: 'rgba(235, 87, 87, 0.7)',
                    borderColor: '#EB5757',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                ...commonOptions,
                plugins: {
                    legend: { display: true, position: 'top' }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            autoSkip: false,
                            maxRotation: 45,
                            minRotation: 45
                        }
                    },
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
        
        // 腎機能グラフ（クレアチニン・BUN）
        const creatinineData = data.map(d => {
            const val = d.labtest?.creatinine;
            return (val && val > 0) ? Number(val) : null;
        });
        const bunData = data.map(d => {
            const val = d.labtest?.bun;
            return (val && val > 0) ? Number(val) : null;
        });
        
        // データがある日だけ表示
        const kidneyLabels = labels.map((label, index) => {
            return (creatinineData[index] !== null || bunData[index] !== null) ? label : '';
        });
        
        this.createOrUpdateChart('kidney-chart', {
            type: 'line',
            data: {
                labels: kidneyLabels,
                datasets: [
                    {
                        label: 'クレアチニン (mg/dL)',
                        data: creatinineData,
                        borderColor: '#EB5757',
                        backgroundColor: 'rgba(235, 87, 87, 0.1)',
                        fill: false,
                        tension: 0.3,
                        pointRadius: 4,
                        pointBackgroundColor: '#EB5757',
                        spanGaps: true,
                        yAxisID: 'y'
                    },
                    {
                        label: 'BUN (mg/dL)',
                        data: bunData,
                        borderColor: '#F2994A',
                        backgroundColor: 'rgba(242, 153, 74, 0.1)',
                        fill: false,
                        tension: 0.3,
                        pointRadius: 4,
                        pointBackgroundColor: '#F2994A',
                        spanGaps: true,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                ...commonOptions,
                plugins: {
                    legend: { 
                        display: true, 
                        position: 'top',
                        labels: { boxWidth: 12, padding: 8, font: { size: 10 } }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { autoSkip: false, maxRotation: 45, minRotation: 45 }
                    },
                    y: {
                        type: 'linear',
                        position: 'left',
                        title: { display: true, text: 'Cre', font: { size: 10 } },
                        beginAtZero: false
                    },
                    y1: {
                        type: 'linear',
                        position: 'right',
                        title: { display: true, text: 'BUN', font: { size: 10 } },
                        grid: { drawOnChartArea: false },
                        beginAtZero: false
                    }
                }
            }
        });
        
        // 尿検査グラフ（蛋白質・潜血・比重）
        const urineProteinData = data.map(d => {
            const val = d.labtest?.urineProtein;
            return (val && val > 0) ? Number(val) : null;
        });
        const urineBloodData = data.map(d => {
            const val = d.labtest?.urineBlood;
            return (val && val > 0) ? Number(val) : null;
        });
        const urineSgData = data.map(d => {
            const val = d.labtest?.urineSg;
            return (val && val > 0) ? Number(val) : null;
        });
        
        const urineTestLabels = labels.map((label, index) => {
            return (urineProteinData[index] !== null || urineBloodData[index] !== null || urineSgData[index] !== null) ? label : '';
        });
        
        this.createOrUpdateChart('urine-test-chart', {
            type: 'line',
            data: {
                labels: urineTestLabels,
                datasets: [
                    {
                        label: '蛋白質 (mg/dl)',
                        data: urineProteinData,
                        borderColor: '#EB5757',
                        backgroundColor: 'rgba(235, 87, 87, 0.1)',
                        fill: false,
                        tension: 0.3,
                        pointRadius: 4,
                        pointBackgroundColor: '#EB5757',
                        spanGaps: true,
                        yAxisID: 'y'
                    },
                    {
                        label: '潜血 (mg/dl)',
                        data: urineBloodData,
                        borderColor: '#9B51E0',
                        backgroundColor: 'rgba(155, 81, 224, 0.1)',
                        fill: false,
                        tension: 0.3,
                        pointRadius: 4,
                        pointBackgroundColor: '#9B51E0',
                        spanGaps: true,
                        yAxisID: 'y'
                    },
                    {
                        label: '比重',
                        data: urineSgData,
                        borderColor: '#2D9CDB',
                        backgroundColor: 'rgba(45, 156, 219, 0.1)',
                        fill: false,
                        tension: 0.3,
                        pointRadius: 4,
                        pointBackgroundColor: '#2D9CDB',
                        spanGaps: true,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                ...commonOptions,
                plugins: {
                    legend: { 
                        display: true, 
                        position: 'top',
                        labels: { boxWidth: 12, padding: 8, font: { size: 10 } }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { autoSkip: false, maxRotation: 45, minRotation: 45 }
                    },
                    y: {
                        type: 'linear',
                        position: 'left',
                        title: { display: true, text: 'mg/dl', font: { size: 10 } },
                        beginAtZero: true
                    },
                    y1: {
                        type: 'linear',
                        position: 'right',
                        title: { display: true, text: '比重', font: { size: 10 } },
                        grid: { drawOnChartArea: false },
                        min: 1.000,
                        max: 1.060
                    }
                }
            }
        });
        
        // 診断タイムラインを更新
        this.updateDiagnosisTimeline(data);
        
        // 投薬タイムラインを更新
        this.updateMedicineTimeline(data, labels);
    }
    
    // 診断タイムラインを描画
    updateDiagnosisTimeline(data) {
        const container = document.getElementById('diagnosis-timeline');
        if (!container) return;
        
        // 重要な診断・イベントのキーワード
        const importantKeywords = [
            { keyword: '腎盂腎炎', tag: '診断' },
            { keyword: '水腎症', tag: '診断' },
            { keyword: '耐性菌', tag: '検査' },
            { keyword: 'クレアチニン', tag: '検査' },
            { keyword: '貧血', tag: '症状' },
            { keyword: '血尿', tag: '症状' },
            { keyword: 'カテーテル', tag: '処置' },
            { keyword: 'エコー', tag: '検査' },
            { keyword: '血液検査', tag: '検査' },
            { keyword: '開始', tag: '投薬' },
            { keyword: '飲み切り', tag: '投薬' },
            { keyword: 'なくなる', tag: '投薬' },
            { keyword: '嘔吐', tag: '症状' },
            { keyword: '再開', tag: '投薬' }
        ];
        
        // メモから重要なイベントを抽出
        const events = [];
        data.forEach(d => {
            if (!d.daily?.memo) return;
            const memo = d.daily.memo;
            
            // 通院日のみ抽出
            if (!memo.includes('【通院】')) return;
            
            // キーワードにマッチするイベントを抽出
            const matchedTags = [];
            importantKeywords.forEach(item => {
                if (memo.includes(item.keyword)) {
                    matchedTags.push({ keyword: item.keyword, tag: item.tag });
                }
            });
            
            if (matchedTags.length > 0 || memo.includes('【通院】')) {
                const date = new Date(d.date);
                events.push({
                    date: d.date,
                    dateStr: `${date.getMonth() + 1}/${date.getDate()}`,
                    memo: memo.replace('【通院】', '').trim(),
                    tags: matchedTags
                });
            }
        });
        
        if (events.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: var(--text-light); padding: 20px;">診断メモがありません</div>';
            return;
        }
        
        // HTML生成
        let html = events.map(event => {
            const tagHtml = event.tags.slice(0, 3).map(t => 
                `<span class="diagnosis-tag">${t.tag}</span>`
            ).join('');
            
            return `
                <div class="diagnosis-item">
                    <div class="diagnosis-date">${event.dateStr}</div>
                    <div class="diagnosis-content">
                        ${tagHtml}
                        ${event.memo}
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = html;
    }
    
    // 投薬タイムラインを描画
    updateMedicineTimeline(data, labels) {
        const container = document.getElementById('medicine-timeline');
        if (!container) return;
        
        // 処方薬リスト
        const prescriptionMeds = [
            { key: 'rapros', name: 'ラプロス', color: '#E8927C' },
            { key: 'lactulose', name: 'ラクツロース', color: '#7CBAAB' },
            { key: 'clavaseptin', name: 'クラバセプチン', color: '#56CCF2' },
            { key: 'vibramycin', name: 'ビブラマイシン', color: '#F2C94C' },
            { key: 'veraflox', name: 'ベラフロックス', color: '#27AE60' },
            { key: 'appetite', name: 'ミルタザビン（食欲増進薬）', color: '#EB5757' }
        ];
        
        // サプリメントリスト
        const supplements = [
            { key: 'cranberry', name: 'クランベリBB', color: '#BB6BD9' },
            { key: 'uroact', name: 'ウロアクト', color: '#F2994A' },
            { key: 'utclean', name: 'UT Clean', color: '#2D9CDB' }
        ];
        
        const medicines = [...prescriptionMeds, ...supplements];
        
        // HTML生成
        let html = '';
        
        // 点滴行
        html += `
            <div class="medicine-row">
                <div class="medicine-label">🏥 点滴</div>
                <div class="medicine-bar-container">
                    ${data.map(d => {
                        const drip = d.daily?.drip;
                        const dripNum = drip ? Number(drip) : 0;
                        const hasDrip = dripNum > 0;
                        return `<div class="medicine-day ${hasDrip ? 'hospital' : ''}" title="${d.date}${hasDrip ? ' 点滴' + dripNum + 'cc' : ''}"></div>`;
                    }).join('')}
                </div>
            </div>
        `;
        
        // 処方薬セクション
        html += `<div class="medicine-row" style="margin-top: 8px;"><div class="medicine-label" style="font-size: 0.75rem; color: var(--primary);">💊 処方薬</div><div class="medicine-bar-container" style="background: transparent;"></div></div>`;
        
        prescriptionMeds.forEach(med => {
            html += `
                <div class="medicine-row">
                    <div class="medicine-label">${med.name}</div>
                    <div class="medicine-bar-container">
                        ${data.map(d => {
                            const hasThisMed = d.medicine?.[med.key];
                            return `<div class="medicine-day" style="${hasThisMed ? 'background:' + med.color : ''}" title="${d.date}${hasThisMed ? ' ' + med.name : ''}"></div>`;
                        }).join('')}
                    </div>
                </div>
            `;
        });
        
        // サプリメントセクション
        html += `<div class="medicine-row" style="margin-top: 8px;"><div class="medicine-label" style="font-size: 0.75rem; color: var(--secondary);">🌿 サプリ</div><div class="medicine-bar-container" style="background: transparent;"></div></div>`;
        
        supplements.forEach(med => {
            html += `
                <div class="medicine-row">
                    <div class="medicine-label">${med.name}</div>
                    <div class="medicine-bar-container">
                        ${data.map(d => {
                            const hasThisMed = d.medicine?.[med.key];
                            return `<div class="medicine-day" style="${hasThisMed ? 'background:' + med.color : ''}" title="${d.date}${hasThisMed ? ' ' + med.name : ''}"></div>`;
                        }).join('')}
                    </div>
                </div>
            `;
        });
        
        // 日付ラベル
        html += `
            <div class="medicine-row">
                <div class="medicine-label"></div>
                <div class="medicine-bar-container" style="background: transparent; justify-content: space-between; font-size: 0.7rem; color: var(--text-light);">
                    <span>${labels[0] || ''}</span>
                    <span>${labels[Math.floor(labels.length/2)] || ''}</span>
                    <span>${labels[labels.length-1] || ''}</span>
                </div>
            </div>
        `;
        
        // 凡例
        html += `
            <div class="medicine-legend">
                <div class="legend-item">
                    <div class="legend-color hospital"></div>
                    <span>点滴日</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color medicine"></div>
                    <span>投薬あり</span>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
    }
    
    // チャートを作成または更新
    createOrUpdateChart(canvasId, config) {
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }
        
        const ctx = document.getElementById(canvasId);
        if (ctx) {
            this.charts[canvasId] = new Chart(ctx, config);
        }
    }
    
    // データをエクスポート
    exportData() {
        const catName = APP_STATE.cats[APP_STATE.currentCat].name;
        
        // JSON全データ
        const allData = this.data.exportAllData();
        const jsonBlob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
        
        // CSVデータ
        const csv = this.data.exportDailyToCSV(APP_STATE.currentCat);
        const csvBlob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
        
        // ダウンロード
        const timestamp = new Date().toISOString().split('T')[0];
        
        // JSONダウンロード
        const jsonLink = document.createElement('a');
        jsonLink.href = URL.createObjectURL(jsonBlob);
        jsonLink.download = `${catName}_全データ_${timestamp}.json`;
        jsonLink.click();
        
        // CSVダウンロード
        setTimeout(() => {
            const csvLink = document.createElement('a');
            csvLink.href = URL.createObjectURL(csvBlob);
            csvLink.download = `${catName}_日次データ_${timestamp}.csv`;
            csvLink.click();
        }, 500);
        
        Utils.showToast('データをエクスポートしました！', '📥');
    }
}

// ========================================
// アプリケーション初期化
// ========================================
let dataManager;
let ui;

document.addEventListener('DOMContentLoaded', () => {
    dataManager = new DataManager();
    ui = new UIController(dataManager);
    ui.init();
    
    console.log('🐱 にゃん健康手帳 起動完了！');
});

// グローバルに公開（削除ボタン用）
window.ui = null;
document.addEventListener('DOMContentLoaded', () => {
    window.ui = ui;
});

