/**
 * 🐱 にゃん健康手帳 - Google Apps Script
 * 
 * このスクリプトをGoogle Spreadsheetの Apps Script に貼り付けてください。
 * 
 * セットアップ手順:
 * 1. Google Spreadsheetを新規作成
 * 2. 以下のシートを作成: 日次記録, 排泄詳細, 投薬記録, 診察記録
 * 3. 拡張機能 → Apps Script を開く
 * 4. このコードを貼り付け
 * 5. 「setSpreadsheetId」関数を実行してスプレッドシートIDを設定
 *    （関数を選択して「実行」ボタンをクリック、または直接実行）
 * 6. デプロイ → 新しいデプロイ → ウェブアプリ
 * 7. アクセス: 全員 にして デプロイ
 * 8. 表示されたURLをアプリの設定に入力
 */

// ========================================
// 設定
// ========================================

// スプレッドシートIDはスクリプトプロパティに保存（環境変数として管理）
// 設定方法: setSpreadsheetId 関数を実行

// シート名
const SHEETS = {
  DAILY: '日次記録',
  TOILET: '排泄詳細',
  MEDICINE: '投薬記録',
  HOSPITAL: '診察記録',
  LABTEST: '検査結果'
};

// ========================================
// ウェブアプリのエントリーポイント
// ========================================

/**
 * GETリクエスト処理
 */
function doGet(e) {
  const action = e.parameter.action;
  const cat = e.parameter.cat;
  const date = e.parameter.date;
  
  let result;
  
  try {
    switch (action) {
      case 'getDailyRecord':
        result = getDailyRecord(cat, date);
        break;
      case 'getToiletRecords':
        result = getToiletRecords(cat, date);
        break;
      case 'getAllData':
        result = getAllData(cat, e.parameter.startDate, e.parameter.endDate);
        break;
      default:
        result = { error: 'Unknown action' };
    }
  } catch (error) {
    result = { error: error.toString() };
  }
  
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * POSTリクエスト処理
 */
function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const action = data.action;
  
  let result;
  
  try {
    switch (action) {
      case 'saveDailyRecord':
        result = saveDailyRecord(data);
        break;
      case 'addToiletRecord':
        result = addToiletRecord(data);
        break;
      case 'saveMedicineRecord':
        result = saveMedicineRecord(data);
        break;
      case 'saveHospitalRecord':
        result = saveHospitalRecord(data);
        break;
      case 'deleteToiletRecord':
        result = deleteToiletRecord(data);
        break;
      case 'saveLabtestRecord':
        result = saveLabtestRecord(data);
        break;
      default:
        result = { error: 'Unknown action' };
    }
  } catch (error) {
    result = { error: error.toString() };
  }
  
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ========================================
// ヘルパー関数
// ========================================

/**
 * スプレッドシートを取得
 */
function getSpreadsheet() {
  const props = PropertiesService.getScriptProperties();
  const spreadsheetId = props.getProperty('SPREADSHEET_ID');
  
  if (!spreadsheetId) {
    throw new Error('スプレッドシートIDが設定されていません。setSpreadsheetId 関数を実行してください。');
  }
  
  return SpreadsheetApp.openById(spreadsheetId);
}

/**
 * シートを取得（なければ作成）
 */
function getSheet(sheetName) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    initializeSheet(sheet, sheetName);
  }
  
  return sheet;
}

/**
 * シートの初期化（ヘッダー行を追加）
 */
function initializeSheet(sheet, sheetName) {
  const headers = {
    [SHEETS.DAILY]: [
      '日付', '猫', '体重(kg)', '元気度', '食欲',
      '飲水量(cc)', 'カリカリ(g)', 'ウェット(g)', 'チュール(本)', 'おやつ(袋)',
      '尿回数', '便回数', '便の状態', '点滴(cc)', 'メモ', '更新日時'
    ],
    [SHEETS.TOILET]: [
      '日付', '時刻', '猫', '種類', '量', 'メモ', '記録ID', '作成日時'
    ],
    [SHEETS.MEDICINE]: [
      '日付', '猫', 'タイミング', 'ラプロス', 'ラクツロース', 'クランベリBB',
      'クラバセプチン', 'ビブラマイシン', 'ウロアクト', 'UT Clean',
      'ベラフロックス', 'ミルタザビン（食欲増進薬）', 'その他', '更新日時'
    ],
    [SHEETS.HOSPITAL]: [
      '日時', '猫', '体重(kg)', '点滴', '点滴量(cc)', 'エコー検査',
      '血液検査', '尿検査', '所見・診断', '処方薬', '記録ID', '作成日時'
    ],
    [SHEETS.LABTEST]: [
      '日付', '猫',
      // 血液CBC
      '白血球数', 'ヘマトクリット', '血小板数',
      // 血液生化学
      '血糖値', '総蛋白', 'アルブミン', 'BUN', 'クレアチニン', '総ビリルビン',
      'AST', 'ALT', 'ALP', 'リパーゼ', 'CPK', 'カルシウム', 'リン', 'Na', 'K', 'Cl',
      // 尿検査（定性+定量）
      'ブドウ糖定性', 'ブドウ糖定量', '蛋白定性', '蛋白定量', 'ビリルビン定性', 'ビリルビン定量',
      'pH', '比重', '潜血定性', '潜血定量', 'ケトン体定性', 'ケトン体定量', '亜硝酸塩', '白血球(尿)',
      'メモ', '更新日時'
    ]
  };
  
  if (headers[sheetName]) {
    sheet.getRange(1, 1, 1, headers[sheetName].length).setValues([headers[sheetName]]);
    sheet.getRange(1, 1, 1, headers[sheetName].length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
}

/**
 * 日付でデータを検索
 */
function findRowByDateAndCat(sheet, date, cat, colDate = 1, colCat = 2) {
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    const rowDate = data[i][colDate - 1];
    const rowCat = data[i][colCat - 1];
    
    // 日付を文字列に変換して比較
    let dateStr = rowDate;
    if (rowDate instanceof Date) {
      dateStr = Utilities.formatDate(rowDate, 'Asia/Tokyo', 'yyyy-MM-dd');
    }
    
    if (dateStr === date && rowCat === cat) {
      return i + 1; // 1-indexed
    }
  }
  
  return -1;
}

// ========================================
// 日次記録
// ========================================

/**
 * 日次記録を保存
 */
function saveDailyRecord(data) {
  const sheet = getSheet(SHEETS.DAILY);
  const cat = data.cat === 'lucky' ? 'ラッキー' : 'ミー';
  const existingRow = findRowByDateAndCat(sheet, data.date, cat);
  
  const row = [
    data.date,
    cat,
    data.weight || '',
    convertEnergy(data.energy),
    convertAppetite(data.appetite),
    data.water || '',
    data.dryFood || '',
    data.wetFood || '',
    data.churu || '',
    data.treats || '',
    data.urineCount || '',
    data.fecesCount || '',
    convertFecesCondition(data.fecesCondition),
    data.drip || '',
    data.memo || '',
    new Date()
  ];
  
  if (existingRow > 0) {
    sheet.getRange(existingRow, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
  
  return { success: true };
}

/**
 * 日次記録を取得
 */
function getDailyRecord(cat, date) {
  const sheet = getSheet(SHEETS.DAILY);
  const catName = cat === 'lucky' ? 'ラッキー' : 'ミー';
  const rowNum = findRowByDateAndCat(sheet, date, catName);
  
  if (rowNum < 0) {
    return null;
  }
  
  const row = sheet.getRange(rowNum, 1, 1, 16).getValues()[0];
  
  return {
    date: row[0],
    cat: cat,
    weight: row[2],
    energy: reverseEnergy(row[3]),
    appetite: reverseAppetite(row[4]),
    water: row[5],
    dryFood: row[6],
    wetFood: row[7],
    churu: row[8],
    treats: row[9],
    urineCount: row[10],
    fecesCount: row[11],
    fecesCondition: reverseFecesCondition(row[12]),
    drip: row[13],
    memo: row[14]
  };
}

// ========================================
// 排泄記録
// ========================================

/**
 * 排泄記録を追加
 */
function addToiletRecord(data) {
  const sheet = getSheet(SHEETS.TOILET);
  const cat = data.cat === 'lucky' ? 'ラッキー' : 'ミー';
  const recordId = Utilities.getUuid();
  
  const row = [
    data.date,
    data.time,
    cat,
    convertToiletType(data.type),
    convertAmount(data.amount),
    data.memo || '',
    recordId,
    new Date()
  ];
  
  sheet.appendRow(row);
  
  return { success: true, id: recordId };
}

/**
 * 排泄記録を取得
 */
function getToiletRecords(cat, date) {
  const sheet = getSheet(SHEETS.TOILET);
  const catName = cat === 'lucky' ? 'ラッキー' : 'ミー';
  const data = sheet.getDataRange().getValues();
  const records = [];
  
  for (let i = 1; i < data.length; i++) {
    let rowDate = data[i][0];
    if (rowDate instanceof Date) {
      rowDate = Utilities.formatDate(rowDate, 'Asia/Tokyo', 'yyyy-MM-dd');
    }
    
    if (rowDate === date && data[i][2] === catName) {
      records.push({
        date: rowDate,
        time: data[i][1],
        cat: cat,
        type: reverseToiletType(data[i][3]),
        amount: reverseAmount(data[i][4]),
        memo: data[i][5],
        id: data[i][6]
      });
    }
  }
  
  // 時刻でソート
  records.sort((a, b) => a.time.localeCompare(b.time));
  
  return records;
}

/**
 * 排泄記録を削除
 */
function deleteToiletRecord(data) {
  const sheet = getSheet(SHEETS.TOILET);
  const sheetData = sheet.getDataRange().getValues();
  
  for (let i = 1; i < sheetData.length; i++) {
    if (sheetData[i][6] === data.id) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  
  return { success: false, error: 'Record not found' };
}

// ========================================
// 投薬記録
// ========================================

/**
 * 投薬記録を保存
 */
function saveMedicineRecord(data) {
  const sheet = getSheet(SHEETS.MEDICINE);
  const cat = data.cat === 'lucky' ? 'ラッキー' : 'ミー';
  const timing = convertTiming(data.timing);
  
  // 既存の同日・同タイミングの記録を探す
  const sheetData = sheet.getDataRange().getValues();
  let existingRow = -1;
  
  for (let i = 1; i < sheetData.length; i++) {
    let rowDate = sheetData[i][0];
    if (rowDate instanceof Date) {
      rowDate = Utilities.formatDate(rowDate, 'Asia/Tokyo', 'yyyy-MM-dd');
    }
    
    if (rowDate === data.date && sheetData[i][1] === cat && sheetData[i][2] === timing) {
      existingRow = i + 1;
      break;
    }
  }
  
  const medicines = data.medicines || [];
  const row = [
    data.date,
    cat,
    timing,
    medicines.includes('rapros'),
    medicines.includes('lactulose'),
    medicines.includes('cranberry'),
    medicines.includes('clavaseptin'),
    medicines.includes('vibramycin'),
    medicines.includes('uroact'),
    medicines.includes('utclean'),
    medicines.includes('veraflox'),
    medicines.includes('appetite'),
    data.memo || '',
    new Date()
  ];
  
  if (existingRow > 0) {
    sheet.getRange(existingRow, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
  
  return { success: true };
}

// ========================================
// 診察記録
// ========================================

/**
 * 診察記録を保存
 */
function saveHospitalRecord(data) {
  const sheet = getSheet(SHEETS.HOSPITAL);
  const cat = data.cat === 'lucky' ? 'ラッキー' : 'ミー';
  const treatments = data.treatments || [];
  const recordId = Utilities.getUuid();
  
  const row = [
    data.datetime,
    cat,
    data.weight || '',
    treatments.includes('drip'),
    data.dripAmount || '',
    treatments.includes('echo'),
    treatments.includes('blood'),
    treatments.includes('urine'),
    data.diagnosis || '',
    data.prescription || '',
    recordId,
    new Date()
  ];
  
  sheet.appendRow(row);
  
  return { success: true, id: recordId };
}

// ========================================
// 検査結果
// ========================================

/**
 * 検査結果を保存
 */
function saveLabtestRecord(data) {
  const sheet = getSheet(SHEETS.LABTEST);
  const cat = data.cat === 'lucky' ? 'ラッキー' : 'ミー';
  const existingRow = findRowByDateAndCat(sheet, data.date, cat);
  
  const row = [
    data.date,
    cat,
    // 血液CBC
    data.wbc || '',
    data.hct || '',
    data.plt || '',
    // 血液生化学
    data.glucose || '',
    data.tp || '',
    data.alb || '',
    data.bun || '',
    data.creatinine || '',
    data.tbil || '',
    data.ast || '',
    data.alt || '',
    data.alp || '',
    data.lipase || '',
    data.cpk || '',
    data.calcium || '',
    data.phosphorus || '',
    data.sodium || '',
    data.potassium || '',
    data.chloride || '',
    // 尿検査（定性+定量）
    convertQualitative(data.urineGlucoseQual),
    data.urineGlucose || '',
    convertQualitative(data.urineProteinQual),
    data.urineProtein || '',
    convertQualitative(data.urineBilirubinQual),
    data.urineBilirubin || '',
    data.urinePh || '',
    data.urineSg || '',
    convertQualitative(data.urineBloodQual),
    data.urineBlood || '',
    convertQualitative(data.urineKetoneQual),
    data.urineKetone || '',
    convertNitrite(data.urineNitrite),
    data.urineWbc || '',
    data.memo || '',
    new Date()
  ];
  
  if (existingRow > 0) {
    sheet.getRange(existingRow, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
  
  return { success: true };
}

// 定性結果の変換（−を保存用に変換）
function convertQualitative(value) {
  if (value === '-') return '−'; // ハイフンを全角マイナスに
  return value || '';
}

// 定性結果の逆変換（読み込み用）
function reverseQualitative(value) {
  if (value === '−') return '-'; // 全角マイナスをハイフンに
  return value || '';
}

// 亜硝酸塩の変換
function convertNitrite(value) {
  const map = { 'negative': '−', 'positive': '+' };
  return map[value] || value || '';
}

// ========================================
// データ変換ヘルパー
// ========================================

function convertEnergy(value) {
  const map = { 'good': '元気', 'normal': '普通', 'low': '低下' };
  return map[value] || value;
}

function reverseEnergy(value) {
  const map = { '元気': 'good', '普通': 'normal', '低下': 'low' };
  return map[value] || value;
}

function convertAppetite(value) {
  const map = { 'good': '増', 'normal': '普通', 'low': '減', 'none': 'なし' };
  return map[value] || value;
}

function reverseAppetite(value) {
  const map = { '増': 'good', '普通': 'normal', '減': 'low', 'なし': 'none' };
  return map[value] || value;
}

function convertFecesCondition(value) {
  const map = { 'good': '良好', 'hard': '硬い', 'soft': '柔らかい', 'none': 'なし' };
  return map[value] || value;
}

function reverseFecesCondition(value) {
  const map = { '良好': 'good', '硬い': 'hard', '柔らかい': 'soft', 'なし': 'none' };
  return map[value] || value;
}

function convertToiletType(value) {
  const map = { 'urine': '尿', 'feces': '便', 'both': '両方' };
  return map[value] || value;
}

function reverseToiletType(value) {
  const map = { '尿': 'urine', '便': 'feces', '両方': 'both' };
  return map[value] || value;
}

function convertAmount(value) {
  const map = { 'normal': '普通', 'more': '多め', 'less': '少量', 'drops': '数滴' };
  return map[value] || value;
}

function reverseAmount(value) {
  const map = { '普通': 'normal', '多め': 'more', '少量': 'less', '数滴': 'drops' };
  return map[value] || value;
}

function convertTiming(value) {
  const map = { 'morning': '朝', 'noon': '昼', 'evening': '夜' };
  return map[value] || value;
}

// ========================================
// 全データ取得（グラフ用）
// ========================================

function getAllData(cat, startDate, endDate) {
  const dailySheet = getSheet(SHEETS.DAILY);
  const toiletSheet = getSheet(SHEETS.TOILET);
  const labtestSheet = getSheet(SHEETS.LABTEST);
  const medicineSheet = getSheet(SHEETS.MEDICINE);
  const catName = cat === 'lucky' ? 'ラッキー' : 'ミー';
  
  const dailyData = dailySheet.getDataRange().getValues();
  const toiletData = toiletSheet.getDataRange().getValues();
  const labtestData = labtestSheet.getDataRange().getValues();
  const medicineData = medicineSheet.getDataRange().getValues();
  
  const result = [];
  
  // 日付範囲を生成
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd');
    
    // 日次データを検索
    let daily = null;
    for (let i = 1; i < dailyData.length; i++) {
      let rowDate = dailyData[i][0];
      if (rowDate instanceof Date) {
        rowDate = Utilities.formatDate(rowDate, 'Asia/Tokyo', 'yyyy-MM-dd');
      } else if (typeof rowDate === 'string' && rowDate.includes('/')) {
        // 文字列形式の日付（2025/12/31）を yyyy-MM-dd に変換
        const parts = rowDate.split('/');
        if (parts.length === 3) {
          rowDate = `${parts[0]}-${String(parts[1]).padStart(2, '0')}-${String(parts[2]).padStart(2, '0')}`;
        }
      }
      
      if (rowDate === dateStr && dailyData[i][1] === catName) {
        const dripValue = dailyData[i][13];
        const dripNum = dripValue === '' || dripValue === null ? 0 : Number(dripValue);
        
        daily = {
          weight: dailyData[i][2],
          energy: reverseEnergy(dailyData[i][3]),
          appetite: reverseAppetite(dailyData[i][4]),
          water: dailyData[i][5],
          dryFood: dailyData[i][6],
          wetFood: dailyData[i][7],
          churu: dailyData[i][8],
          treats: dailyData[i][9],
          urineCount: dailyData[i][10],
          fecesCount: dailyData[i][11],
          fecesCondition: reverseFecesCondition(dailyData[i][12]),
          drip: dripNum || 0,
          memo: dailyData[i][14]
        };
        break;
      }
    }
    
    // 排泄データをカウント
    let urineCount = 0;
    let fecesCount = 0;
    for (let i = 1; i < toiletData.length; i++) {
      let rowDate = toiletData[i][0];
      if (rowDate instanceof Date) {
        rowDate = Utilities.formatDate(rowDate, 'Asia/Tokyo', 'yyyy-MM-dd');
      } else if (typeof rowDate === 'string' && rowDate.includes('/')) {
        // 文字列形式の日付（2025/12/31）を yyyy-MM-dd に変換
        const parts = rowDate.split('/');
        if (parts.length === 3) {
          rowDate = `${parts[0]}-${String(parts[1]).padStart(2, '0')}-${String(parts[2]).padStart(2, '0')}`;
        }
      }
      
      if (rowDate === dateStr && toiletData[i][2] === catName) {
        const type = toiletData[i][3];
        if (type === '尿' || type === '両方') urineCount++;
        if (type === '便' || type === '両方') fecesCount++;
      }
    }
    
    // 検査結果データを検索
    let labtest = null;
    for (let i = 1; i < labtestData.length; i++) {
      let rowDate = labtestData[i][0];
      if (rowDate instanceof Date) {
        rowDate = Utilities.formatDate(rowDate, 'Asia/Tokyo', 'yyyy-MM-dd');
      } else if (typeof rowDate === 'string' && rowDate.includes('/')) {
        const parts = rowDate.split('/');
        if (parts.length === 3) {
          rowDate = `${parts[0]}-${String(parts[1]).padStart(2, '0')}-${String(parts[2]).padStart(2, '0')}`;
        }
      }
      
      if (rowDate === dateStr && labtestData[i][1] === catName) {
        labtest = {
          // 血液CBC
          wbc: labtestData[i][2] || null,
          hct: labtestData[i][3] || null,
          plt: labtestData[i][4] || null,
          // 血液生化学
          glucose: labtestData[i][5] || null,
          tp: labtestData[i][6] || null,
          alb: labtestData[i][7] || null,
          bun: labtestData[i][8] || null,
          creatinine: labtestData[i][9] || null,
          tbil: labtestData[i][10] || null,
          ast: labtestData[i][11] || null,
          alt: labtestData[i][12] || null,
          alp: labtestData[i][13] || null,
          lipase: labtestData[i][14] || null,
          cpk: labtestData[i][15] || null,
          calcium: labtestData[i][16] || null,
          phosphorus: labtestData[i][17] || null,
          sodium: labtestData[i][18] || null,
          potassium: labtestData[i][19] || null,
          chloride: labtestData[i][20] || null,
          // 尿検査（定性+定量）
          urineGlucoseQual: reverseQualitative(labtestData[i][21]),
          urineGlucose: labtestData[i][22] || null,
          urineProteinQual: reverseQualitative(labtestData[i][23]),
          urineProtein: labtestData[i][24] || null,
          urineBilirubinQual: reverseQualitative(labtestData[i][25]),
          urineBilirubin: labtestData[i][26] || null,
          urinePh: labtestData[i][27] || null,
          urineSg: labtestData[i][28] || null,
          urineBloodQual: reverseQualitative(labtestData[i][29]),
          urineBlood: labtestData[i][30] || null,
          urineKetoneQual: reverseQualitative(labtestData[i][31]),
          urineKetone: labtestData[i][32] || null,
          urineNitrite: labtestData[i][33] || null,
          urineWbc: labtestData[i][34] || null
        };
        break;
      }
    }
    
    // 投薬データを検索
    let medicine = {
      rapros: false,
      lactulose: false,
      cranberry: false,
      clavaseptin: false,
      vibramycin: false,
      uroact: false,
      utclean: false,
      veraflox: false,
      appetite: false
    };
    for (let i = 1; i < medicineData.length; i++) {
      let rowDate = medicineData[i][0];
      if (rowDate instanceof Date) {
        rowDate = Utilities.formatDate(rowDate, 'Asia/Tokyo', 'yyyy-MM-dd');
      } else if (typeof rowDate === 'string' && rowDate.includes('/')) {
        const parts = rowDate.split('/');
        if (parts.length === 3) {
          rowDate = `${parts[0]}-${String(parts[1]).padStart(2, '0')}-${String(parts[2]).padStart(2, '0')}`;
        }
      }
      
      if (rowDate === dateStr && medicineData[i][1] === catName) {
        // 各薬のチェック（TRUE/○があれば投薬あり）
        if (medicineData[i][3]) medicine.rapros = true;       // ラプロス
        if (medicineData[i][4]) medicine.lactulose = true;    // ラクツロース
        if (medicineData[i][5]) medicine.cranberry = true;    // クランベリBB
        if (medicineData[i][6]) medicine.clavaseptin = true;  // クラバセプチン
        if (medicineData[i][7]) medicine.vibramycin = true;   // ビブラマイシン
        if (medicineData[i][8]) medicine.uroact = true;       // ウロアクト
        if (medicineData[i][9]) medicine.utclean = true;      // UT Clean
        if (medicineData[i][10]) medicine.veraflox = true;    // ベラフロックス
        if (medicineData[i][11]) medicine.appetite = true;    // ミルタザビン
      }
    }
    
    result.push({
      date: dateStr,
      daily: daily,
      toiletCount: { urine: urineCount, feces: fecesCount },
      labtest: labtest,
      medicine: medicine
    });
  }
  
  return result;
}

// ========================================
// セットアップ関数
// ========================================

/**
 * スプレッドシートIDを設定（初回のみ実行）
 * 
 * 使い方:
 * 1. この関数を選択
 * 2. SPREADSHEET_ID の値を自分のスプレッドシートIDに変更
 * 3. 「実行」ボタンをクリック
 * 
 * スプレッドシートIDの見つけ方:
 * - Google SpreadsheetのURL: https://docs.google.com/spreadsheets/d/【ここがID】/edit
 * - /d/ と /edit の間の文字列がIDです
 */
function setSpreadsheetId() {
  // ⚠️ ここに自分のスプレッドシートIDを入力してください
  const SPREADSHEET_ID = '16NoJl_VQVV5tFN8c042Ayno6GfSjbNipHkOFwV2Gxqg';
  
  if (!SPREADSHEET_ID || SPREADSHEET_ID === 'YOUR_SPREADSHEET_ID_HERE') {
    Logger.log('❌ エラー: スプレッドシートIDを設定してください');
    return;
  }
  
  const props = PropertiesService.getScriptProperties();
  props.setProperty('SPREADSHEET_ID', SPREADSHEET_ID);
  
  Logger.log('✅ スプレッドシートIDを設定しました: ' + SPREADSHEET_ID);
  Logger.log('📋 次に testSetup 関数を実行してシートを初期化してください');
}

/**
 * 現在設定されているスプレッドシートIDを確認
 */
function getSpreadsheetId() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SPREADSHEET_ID');
  
  if (id) {
    Logger.log('現在のスプレッドシートID: ' + id);
  } else {
    Logger.log('❌ スプレッドシートIDが設定されていません');
  }
  
  return id;
}

// ========================================
// テスト用関数
// ========================================

function testSetup() {
  // シートを初期化
  getSheet(SHEETS.DAILY);
  getSheet(SHEETS.TOILET);
  getSheet(SHEETS.MEDICINE);
  getSheet(SHEETS.HOSPITAL);
  getSheet(SHEETS.LABTEST);
  
  Logger.log('✅ シートの初期化が完了しました！');
}

