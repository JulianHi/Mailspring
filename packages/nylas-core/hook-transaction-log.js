const PubsubConnector = require('./pubsub-connector')

module.exports = (db, sequelize) => {
  const parseHookData = ({dataValues, _changed, $modelOptions}) => {
    return {
      objectId: dataValues.id,
      modelName: $modelOptions.name.singular,
      changedFields: _changed,
    }
  }

  const isSilent = (data) => {
    data._previousDataValues
    data._changed

    if (data.$modelOptions.name.singular === "transaction") {
      return true
    }

    if (data._changed && data._changed.syncState) {
      for (const key of Object.keys(data._changed)) {
        if (key === "syncState") { continue }
        if (data._changed[key] !== data._previousDataValues[key]) {
          // SyncState changed, but so did something else
          return false;
        }
      }
      // Be silent due to nothing but sync state changing
      return true;
    }
  }

  const transactionLogger = (type) => {
    return (sequelizeHookData) => {
      if (isSilent(sequelizeHookData)) return;

      const transactionData = Object.assign({type: type},
        parseHookData(sequelizeHookData)
      );
      db.Transaction.create(transactionData);
      transactionData.object = sequelizeHookData.dataValues;

      PubsubConnector.notifyDelta(db.accountId, transactionData);
    }
  }

  sequelize.addHook("afterCreate", transactionLogger("create"))
  sequelize.addHook("afterUpdate", transactionLogger("update"))
  sequelize.addHook("afterDelete", transactionLogger("delete"))
}
