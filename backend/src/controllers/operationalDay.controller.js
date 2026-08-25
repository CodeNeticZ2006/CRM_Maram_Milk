const {
  getCurrentOperationalDay,
  getOperationalDayHistory,
  checkAndTriggerRollover,
  executeDailyRollover,
  getExpectedOperationalDate,
} = require('../services/operationalDay.service');

// GET /api/operational-day/current
const getCurrentDay = async (req, res, next) => {
  try {
    const data = await getCurrentOperationalDay();
    res.json({
      success: true,
      data,
    });
  } catch (err) { next(err); }
};

// GET /api/operational-day/history
const getHistory = async (req, res, next) => {
  try {
    const { limit = 30 } = req.query;
    const history = await getOperationalDayHistory(parseInt(limit));
    res.json({
      success: true,
      data: history,
    });
  } catch (err) { next(err); }
};

// POST /api/operational-day/trigger-rollover (Super Admin manual trigger or force check)
const triggerRollover = async (req, res, next) => {
  try {
    const result = await checkAndTriggerRollover();
    
    // If user explicitly requests a forced rollover to next day
    if (req.body.forceNextDay) {
      const current = await getCurrentOperationalDay();
      const nextDate = req.body.targetDate || getExpectedOperationalDate();
      const forcedResult = await executeDailyRollover(current.date, nextDate);
      return res.json({
        success: true,
        message: `Forced rollover executed from ${current.date} to ${nextDate}`,
        result: forcedResult,
      });
    }

    res.json({
      success: true,
      message: result.status === 'SUCCESS' ? 'Daily operational rollover executed successfully.' : `Rollover status: ${result.status}`,
      result,
    });
  } catch (err) { next(err); }
};

module.exports = {
  getCurrentDay,
  getHistory,
  triggerRollover,
};
