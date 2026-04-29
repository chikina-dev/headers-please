import type { HandbookAction, HandbookGlossaryEntry, UnitReference } from './types';

export const HANDBOOK_ACTIONS: HandbookAction[] = [
  {
    id: 'read-packet',
    label: '個包を読む',
    description: '方向、送信元、宛先、必要ならプロトコルまで確認してから判断する。',
  },
  {
    id: 'assign-external-port',
    label: '色スタンプを押す',
    description: '外側ポートが必要な段階では、使う色を決めて個包に割り当てる。',
  },
  {
    id: 'rewrite-outbound-source',
    label: '送信元を書き換える',
    description: 'LAN 側の住所はそのまま外に出せないので、自宅や自宅:色へ変換する。',
  },
  {
    id: 'register-table',
    label: 'テーブルへ記録する',
    description: '戻り通信を正しく復元するため、今の通信の識別キーをテーブルに残す。',
  },
  {
    id: 'lookup-table',
    label: 'テーブルを照合する',
    description: 'WAN から来た通信は、今の段階で使える識別キーで必ず照合する。',
  },
  {
    id: 'select-entry',
    label: '該当行を選ぶ',
    description: '戻り通信は、該当する 1 行を選んで内側の宛先を復元する。',
  },
  {
    id: 'restore-target',
    label: '内側宛先を復元する',
    description: '必要な内側ホストや内側ポートまで戻せるかを確認してから通す。',
  },
  {
    id: 'accept-outbound',
    label: 'ACCEPTで外へ送る',
    description: 'LAN -> WAN は変換と記録が正しければ ACCEPT で右へ送る。',
  },
  {
    id: 'accept-inbound',
    label: 'ACCEPTで内側へ戻す',
    description: 'WAN -> LAN は一致するテーブル行がある時だけ ACCEPT する。',
  },
  {
    id: 'watch-timeout',
    label: '期限切れを監視する',
    description: '古い通信は残り時間を見て管理し、消えた色を再利用できるようにする。',
  },
  {
    id: 'close-entry',
    label: '通信を終了する',
    description: '使い終わった行を手動で閉じて、外側ポートを再利用可能にする。',
  },
  {
    id: 'reject-on-exhaustion',
    label: '満杯なら拒否する',
    description: '使える色が残っていない時は、新しい通信を REJECT して守る判断も必要になる。',
  },
  {
    id: 'reject-packet',
    label: 'REJECTする',
    description: '記録がない、キーが一致しない、仕様上区別不能なら REJECT が正解になる。',
  },
];

export const HANDBOOK_GLOSSARY: HandbookGlossaryEntry[] = [
  {
    id: 'packet',
    gameTerm: '個包',
    networkTerm: 'パケット',
    description: 'プレイヤーが審査する通信のひとかたまり。',
    relatedColumns: [],
    relatedUnits: [1, 2, 3, 4, 5, 6, 7, 8],
  },
  {
    id: 'home',
    gameTerm: '自宅',
    networkTerm: 'グローバルIP',
    description: 'LAN の外に見せる共通の住所。NAT の最初の外側識別子。',
    relatedColumns: ['externalHost'],
    relatedUnits: [1, 2],
  },
  {
    id: 'stamp',
    gameTerm: '色スタンプ',
    networkTerm: '外側ポート',
    description: '同じ自宅でも通信を分けるための外側ポート番号。',
    relatedColumns: ['externalPort'],
    relatedUnits: [1, 2, 3, 4, 5, 6, 7, 8],
  },
  {
    id: 'destination-host',
    gameTerm: '宛先列',
    networkTerm: '宛先IP',
    description: 'どの相手と話している通信かを区別するための相手先情報。',
    relatedColumns: ['destinationHost'],
    relatedUnits: [2, 3, 4, 5, 6],
  },
  {
    id: 'destination-service',
    gameTerm: 'サービス',
    networkTerm: '宛先ポート',
    description: '同じ相手でも Web と Game など、相手側のサービスを区別するキー。',
    relatedColumns: ['destinationService'],
    relatedUnits: [3, 4, 5, 6],
  },
  {
    id: 'internal-port',
    gameTerm: '番号タグ',
    networkTerm: '内側ポート',
    description: '同じPC内のどのアプリへ戻すかを決めるための内側識別子。',
    relatedColumns: ['internalPort'],
    relatedUnits: [4, 5, 6],
  },
  {
    id: 'protocol',
    gameTerm: 'プロトコル',
    networkTerm: 'TCP / UDP',
    description: '同じ宛先・ポートでも TCP と UDP は別の通信として扱う必要がある。',
    relatedColumns: ['protocol'],
    relatedUnits: [6],
  },
  {
    id: 'timeout',
    gameTerm: '期限切れ',
    networkTerm: 'タイムアウト',
    description: '一定時間返答がない通信はテーブルから消え、使っていた色を再利用できる。',
    relatedColumns: ['externalPort'],
    relatedUnits: [7, 8],
  },
  {
    id: 'exhaustion',
    gameTerm: '満杯',
    networkTerm: 'ポート枯渇',
    description: '利用できる外側ポートがすべて埋まると、新しい通信を始められなくなる状態。',
    relatedColumns: ['externalPort'],
    relatedUnits: [8],
  },
];

export const UNIT_REFERENCES: UnitReference[] = [
  {
    unit: 1,
    title: 'ユニット1: NAT と初期 REJECT',
    objective: '送信元を書き換え、戻り通信をテーブルで復元する基本を学ぶ。',
    failureLesson: '自宅だけでは複数端末の同時通信を一意に戻せない。',
    addedKeys: ['externalHost', 'externalPort'],
    notes: [
      '最初の学習は NAT の往復そのもの。',
      '色スタンプの導入で、外側ポートが識別子として増える。',
      '記録のない通信は REJECT すべきだとここで覚える。',
    ],
  },
  {
    unit: 2,
    title: 'ユニット2: 宛先キー',
    objective: '同じ色を再利用するために、宛先も識別キーに含める。',
    failureLesson: '外側ポートだけだと、同時通信数が増えた時に色が足りなくなる。',
    addedKeys: ['destinationHost'],
    notes: [
      '宛先が違えば、同じ外側ポートでも別の通信として扱える。',
      '戻り通信は色だけではなく、どの相手先の返事かも見る。',
    ],
  },
  {
    unit: 3,
    title: 'ユニット3: 宛先ポート',
    objective: '同じ宛先でもサービスが違えば別通信だと理解する。',
    failureLesson: 'Server-1 の Web と Game は、宛先ポートを見ないと区別できない。',
    addedKeys: ['destinationService'],
    notes: [
      '相手ホストが同じでも、Web と Game では戻り先の判定が変わる。',
      'NAPT は宛先ポートまで含めて照合キーを増やしていく。',
    ],
  },
  {
    unit: 4,
    title: 'ユニット4: 内側ポート',
    objective: '同じPC内の複数アプリへ正しく戻すには内側ポートが必要だと学ぶ。',
    failureLesson: 'PC-A までは分かっても、どのアプリに戻すかは内側ポートがないと決められない。',
    addedKeys: ['internalPort'],
    notes: [
      '戻り通信の最終目的地は PC だけではなくアプリの入口まで含む。',
      'テーブルに内側ポートを持つことで、同じPC内の複数通信を正しく復元できる。',
    ],
  },
  {
    unit: 5,
    title: 'ユニット5: 外側一意性',
    objective: '同じ識別キーの通信に同じ外側ポートを再利用してはいけないと理解する。',
    failureLesson: '同じ相手・同じサービス・同じ色が重なると、戻り通信は再び曖昧になる。',
    addedKeys: ['externalPort'],
    notes: [
      '外側キーは再利用できる場面とできない場面がある。',
      '一意性を守ることも NAPT テーブル管理の重要な役割。',
    ],
  },
  {
    unit: 6,
    title: 'ユニット6: プロトコル',
    objective: 'TCP と UDP を別の通信として扱う最終形の照合を学ぶ。',
    failureLesson: '同じ色・同じ宛先・同じサービスでも、プロトコルが違えば別物。',
    addedKeys: ['protocol'],
    notes: [
      '最後に protocol が加わることで、NAPT テーブルはより厳密になる。',
      'ここまで来ると、通信は複数キーの組み合わせで管理されると理解できる。',
    ],
  },
  {
    unit: 7,
    title: 'ユニット7: タイムアウト管理',
    objective: '通信行は永続ではなく、期限切れや手動終了で色を再利用できると学ぶ。',
    failureLesson: '使い終わった行を放置すると、新しい通信に使える色が減っていく。',
    addedKeys: [],
    notes: [
      '行には寿命があり、待機し続ける通信は自動で消える。',
      '必要なら手動で通信を終了して、色を早く空けることもできる。',
    ],
  },
  {
    unit: 8,
    title: 'ユニット8: ポート枯渇',
    objective: '外側ポートは有限資源なので、満杯なら拒否も正しい運用だと学ぶ。',
    failureLesson: '空き色がない時に無理に新規通信を通すと、既存通信の整合性を壊してしまう。',
    addedKeys: [],
    notes: [
      'NAPT は変換だけでなく、資源管理の仕事も持つ。',
      '新規通信を拒否する判断も、ネットワークを守るための正しい操作になる。',
    ],
  },
];
