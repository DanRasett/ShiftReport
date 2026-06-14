const { Shell } = require('@jsr/xlsft__smartshell-sdk');

interface SmartShellCredentials {
  login: string;
  password: string;
}

interface ShiftData {
  cash: number;
  cashless: number;
  total: number;
}

export interface GoodData {
  id: string;
  name: string;
  quantity: number;
}

let shellInstance: any = null;
let isLoggedIn = false;

export const loginToSmartShell = async (credentials: SmartShellCredentials): Promise<boolean> => {
  try {
    shellInstance = new Shell({
      credentials: {
        login: credentials.login,
        password: credentials.password,
      },
    });

    await shellInstance._initialized;

    if (shellInstance._clubs.length === 0) {
      shellInstance = null;
      return false;
    }

    isLoggedIn = true;
    return true;
  } catch (error: any) {
    console.error('Ошибка входа:', error?.message);
    shellInstance = null;
    isLoggedIn = false;
    return false;
  }
};

export const logoutFromSmartShell = async (): Promise<void> => {
  shellInstance = null;
  isLoggedIn = false;
};

export const isShellLoggedIn = (): boolean => {
  return isLoggedIn && shellInstance !== null;
};

export const getShiftData = async (): Promise<ShiftData | null> => {
  if (!shellInstance || !isLoggedIn) {
    throw new Error('Не выполнен вход в SmartShell');
  }

  try {
    const query = `
      query {
        activeWorkShift {
          payments {
            sum
            method
            status
            is_refunded
            cash_sum
            card_sum
          }
        }
      }
    `;

    const data = await shellInstance.call(query);
    const payments = data?.activeWorkShift?.payments || [];

    let totalCash = 0;
    let totalCashless = 0;
    let skipped = 0;

    payments.forEach((p: any) => {
      const status = (p.status || '').toUpperCase();
      const isRefunded = p.is_refunded === true;

      if (status !== 'PAID' || isRefunded) {
        skipped++;
        return;
      }

      // Проверяем, есть ли раздельные суммы
      const hasCashSum = p.cash_sum !== undefined && p.cash_sum !== null && p.cash_sum > 0;
      const hasCardSum = p.card_sum !== undefined && p.card_sum !== null && p.card_sum > 0;

      if (hasCashSum || hasCardSum) {
        // Раздельный платёж — используем cash_sum и card_sum
        totalCash += p.cash_sum || 0;
        totalCashless += p.card_sum || 0;
      } else {
        // Обычный платёж — смотрим на method
        const method = (p.method || '').toUpperCase();
        if (method === 'CASH') {
          totalCash += p.sum || 0;
        } else if (method === 'CARD') {
          totalCashless += p.sum || 0;
        }
      }
    });

    totalCash = Math.round(totalCash);
    totalCashless = Math.round(totalCashless);

    console.log(`Платежи: всего=${payments.length}, пропущено=${skipped}, нал=${totalCash}, безнал=${totalCashless}`);

    return {
      cash: totalCash,
      cashless: totalCashless,
      total: totalCash + totalCashless,
    };
  } catch (error: any) {
    console.error('Ошибка получения данных смены:', error?.message);

    // Запасной вариант — только money
    try {
      const fallbackQuery = `
        query {
          activeWorkShift {
            money {
              sum
              cash_on_start
            }
          }
        }
      `;
      const fallbackData = await shellInstance.call(fallbackQuery);
      const money = fallbackData?.activeWorkShift?.money;

      if (money) {
        const total = Math.round(parseFloat(money.sum) || 0);
        const cashOnStart = Math.round(parseFloat(money.cash_on_start) || 0);
        return {
          cash: cashOnStart,
          cashless: total - cashOnStart,
          total: total,
        };
      }
    } catch (e: any) {
      console.error('Запасной запрос тоже не сработал:', e?.message);
    }

    return null;
  }
};

export const getGoodsData = async (): Promise<GoodData[]> => {
  if (!shellInstance || !isLoggedIn) {
    throw new Error('Не выполнен вход в SmartShell');
  }

  try {
    const gqlData = await shellInstance.call(`
      query {
        goods {
          id
          title
          amount
        }
      }
    `);

    const goodsList = gqlData?.goods || [];

    const withStock = goodsList
      .filter((g: any) => g.amount > 0)
      .map((g: any) => ({
        id: String(g.id),
        name: g.title,
        quantity: g.amount,
      }));

    return withStock;
  } catch (error: any) {
    console.error('Ошибка получения товаров:', error?.message);
    return [];
  }
};

export const getCurrentWorker = async (): Promise<string | null> => {
  if (!shellInstance || !isLoggedIn) {
    throw new Error('Не выполнен вход в SmartShell');
  }

  try {
    const query = `
      query {
        me {
          first_name
          last_name
          nickname
          login
        }
      }
    `;

    const data = await shellInstance.call(query);
    const me = data?.me;

    if (me) {
      // Собираем полное имя
      const parts = [me.first_name, me.last_name].filter(Boolean);
      if (parts.length > 0) {
        return parts.join(' ');
      }
      // Если нет имени — используем nickname или login
      return me.nickname || me.login || null;
    }

    return null;
  } catch (error: any) {
    console.error('Ошибка получения сотрудника:', error?.message);
    return null;
  }
};

export const getUserRole = async (): Promise<string[]> => {
  if (!shellInstance || !isLoggedIn) {
    return [];
  }

  try {
    const query = `
      query {
        me {
          roles {
            id
            alias
            title
            priority
          }
        }
      }
    `;
    
    const data = await shellInstance.call(query);
    const roles = data?.me?.roles || [];
    
    // Возвращаем массив всех alias
    return roles.map((r: any) => r.alias || '').filter(Boolean);
  } catch (error: any) {
    console.error('Ошибка получения роли:', error?.message);
    return [];
  }
};

export const getFinishedShifts = async (from: string, to: string): Promise<any[]> => {
  if (!shellInstance || !isLoggedIn) {
    throw new Error('Не выполнен вход в SmartShell');
  }

  try {
    // Сначала узнаём структуру WorkShift
    const query = `
      query {
        finishedWorkShifts {
          id
          created_at
          finished_at
          worker {
            id
            first_name
            last_name
          }
          money {
            sum
            cash_on_start
          }
        }
      }
    `;

    const data = await shellInstance.call(query);
    return data?.finishedWorkShifts || [];
  } catch (error: any) {
    console.error('Ошибка получения смен:', error?.message);
    return [];
  }
};

// Получение списка сотрудников
export const getWorkers = async (): Promise<{ id: string; name: string }[]> => {
  if (!shellInstance || !isLoggedIn) return [];
  try {
    const query = `
      query {
        workers(first: 100) {
          data {
            id
            first_name
            last_name
          }
        }
      }
    `;
    const data = await shellInstance.call(query);
    const workersList = data?.workers?.data || [];
    return workersList.map((w: any) => ({
      id: String(w.id),
      name: [w.first_name, w.last_name].filter(Boolean).join(' ') || String(w.id),
    }));
  } catch (e) {
    return [];
  }
};

// Получение товаров с ценами (для выпадающего списка)
export const getGoodsWithPrices = async (): Promise<{ id: string; title: string; cost: number }[]> => {
  if (!shellInstance || !isLoggedIn) return [];
  try {
    const query = `
      query {
        goods {
          id
          title
          cost
        }
      }
    `;
    const data = await shellInstance.call(query);
    return (data?.goods || []).map((g: any) => ({
      id: String(g.id),
      title: g.title || 'Без названия',
      cost: g.cost || 0,
    }));
  } catch (e) { return []; }
};

export interface WorkerInfo {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  middleName: string;
  nickname: string;
  roles: string;
}

// Получение полной информации о сотрудниках
export const getDetailedWorkers = async (): Promise<WorkerInfo[]> => {
  if (!shellInstance || !isLoggedIn) return [];

  try {
    const query = `
      query {
        workers(first: 100) {
          data {
            id
            first_name
            last_name
            middle_name
            phone
            nickname
            roles {
              alias
              title
            }
          }
        }
      }
    `;

    console.log('Запрашиваем сотрудников...');
    const data = await shellInstance.call(query);
    console.log('Ответ:', JSON.stringify(data?.workers?.data?.slice(0, 2)));

    const workersList = data?.workers?.data || [];
    
    return workersList.map((w: any) => ({
      id: String(w.id),
      phone: w.phone || '',
      firstName: w.first_name || '',
      lastName: w.last_name || '',
      middleName: w.middle_name || '',
      nickname: w.nickname || '',
      roles: (w.roles || []).map((r: any) => r.alias || r.title).join(', '),
    }));
  } catch (error: any) {
    console.error('Ошибка получения детальной информации о сотрудниках:', error?.message);
    return [];
  }
};

// Получить список списанных товаров (продажи + взято под ЗП)
export const getGoodsLogs = async (): Promise<{ goodName: string; quantity: number; workerName: string; type: string }[]> => {
  if (!shellInstance || !isLoggedIn) return [];
  try {
    const query = `
      query EventList($input: EventsInput, $page: Int, $first: Int) {
        eventList(input: $input, page: $page, first: $first) {
          data {
            type
            worker {
              first_name
              last_name
            }
            warehouse_item {
              title
              value
            }
          }
        }
      }
    `;
    
    const variables = {
      input: {
        type: 'WAREHOUSE_GOODS_DISPOSED', // Только списания со склада
      },
      first: 100,
      page: 1,
    };

    const data = await shellInstance.call(query, undefined, variables);
    const events = data?.eventList?.data || [];
    
    return events
      .filter((e: any) => e.warehouse_item)
      .map((e: any) => ({
        goodName: e.warehouse_item?.title || 'Неизвестный товар',
        quantity: Math.abs(e.warehouse_item?.value || 0),
        workerName: [e.worker?.first_name, e.worker?.last_name].filter(Boolean).join(' ') || 'Неизвестный',
        type: 'WAREHOUSE_DISPOSED',
      }));
  } catch (e: any) {
    console.log('Ошибка получения логов:', e.message);
    return [];
  }
};