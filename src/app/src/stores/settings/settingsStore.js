import CoreSettingsStore from 'shared/AltStores/Settings/CoreSettingsStore'
import persistence from 'storage/settingStorage'
import alt from '../alt'
import { STORE_NAME } from 'shared/AltStores/Settings/AltSettingsIdentifiers'
import { SettingsIdent, AppSettings } from 'shared/Models/Settings'
import actions from './settingsActions'
import dictionaries from 'shared/SpellcheckProvider/dictionaries.js'
import pkg from 'package.json'
import { RENDER_PROCESS_PREFERENCE_TYPES } from 'shared/processPreferences'
import { renderProcessPreferences } from 'R/atomProcess'

class SettingsStore extends CoreSettingsStore {
  /* **************************************************************************/
  // Lifecycle
  /* **************************************************************************/

  constructor () {
    super()

    /* ****************************************/
    // Render preferences
    /* ****************************************/

    /**
    * Creates a render process entry
    * @return the actual render process entry. This should be stored somewhere
    */
    this.createRenderProcessEntry = () => {
      return renderProcessPreferences.addEntry({
        ...Object.keys(this.launched).reduce((acc, segment) => {
          acc[segment] = this.launched[segment].cloneData()
          return acc
        }, {}),
        type: RENDER_PROCESS_PREFERENCE_TYPES.WB_LAUNCH_SETTINGS
      })
    }

    /* ****************************************/
    // Actions
    /* ****************************************/

    this.bindActions({
      handleMergeSettingsModelChangeset: actions.MERGE_SETTINGS_MODEL_CHANGESET,
      handleToggleSettingsModelField: actions.TOGGLE_SETTINGS_MODEL_FIELD,
      handleRemoveSettingsModelField: actions.REMOVE_SETTINGS_MODEL_FIELD,

      handleSetSpellcheckerLanguage: actions.SET_SPELLCHECKER_LANGUAGE,
      handleSetSecondarySpellcheckerLanguage: actions.SET_SECONDARY_SPELLCHECKER_LANGUAGE,

      handleGlueCurrentUpdateChannel: actions.GLUE_CURRENT_UPDATE_CHANNEL
    })
  }

  /* **************************************************************************/
  // Utils
  /* **************************************************************************/

  /**
  * Saves the settings
  * @param id: the id of the settings
  * @param modelJS: the js for the model
  */
  saveSettingsModel (id, modelJS) {
    this[id] = this.modelize(id, modelJS)
    persistence.setJSONItem(id, modelJS)
    this.dispatchToRemote('remoteSetSettingsModel', [id, modelJS])
  }

  /* **************************************************************************/
  // Remote
  /* **************************************************************************/

  /**
  * Overwrite
  */
  _remoteConnectReturnValue () {
    return {
      modelData: Object.keys(SettingsIdent.SEGMENTS).reduce((acc, k) => {
        const segment = SettingsIdent.SEGMENTS[k]
        acc[segment] = this[segment].cloneData()
        return acc
      }, {}),
      launchedModelData: Object.keys(SettingsIdent.SEGMENTS).reduce((acc, k) => {
        const segment = SettingsIdent.SEGMENTS[k]
        acc[segment] = this.launched[segment].cloneData()
        return acc
      }, {}),
      defaults: this.defaults
    }
  }

  /* **************************************************************************/
  // Model updating
  /* **************************************************************************/

  handleMergeSettingsModelChangeset ({ id, changeset }) {
    this.saveSettingsModel(id, this[id].changeData(changeset))
  }

  handleToggleSettingsModelField ({ id, key }) {
    const modelJS = this[id].cloneData()
    modelJS[key] = !this[id][key]
    this.saveSettingsModel(id, modelJS)
  }

  handleRemoveSettingsModelField ({ id, key }) {
    this.saveSettingsModel(id, this[id].changeData({[key]: undefined}))
  }

  /* **************************************************************************/
  // Updating : Language
  /* **************************************************************************/

  handleSetSpellcheckerLanguage ({ lang }) {
    const primaryInfo = dictionaries[lang]
    const secondaryInfo = (dictionaries[this.language.secondarySpellcheckerLanguage] || {})

    if (primaryInfo.charset !== secondaryInfo.charset) {
      this.saveSettingsModel(SettingsIdent.SEGMENTS.LANGUAGE, this.language.changeData({
        spellcheckerLanguage: lang,
        secondarySpellcheckerLanguage: null
      }))
    } else {
      this.saveSettingsModel(SettingsIdent.SEGMENTS.LANGUAGE, this.language.changeData({
        spellcheckerLanguage: lang
      }))
    }
  }

  handleSetSecondarySpellcheckerLanguage ({ lang }) {
    if (!lang) {
      this.saveSettingsModel(SettingsIdent.SEGMENTS.LANGUAGE, this.language.changeData({
        secondarySpellcheckerLanguage: null
      }))
    } else {
      const primaryInfo = (dictionaries[this.language.spellcheckerLanguage] || {})
      const secondaryInfo = (dictionaries[lang] || {})
      if (primaryInfo.charset === secondaryInfo.charset) {
        this.saveSettingsModel(SettingsIdent.SEGMENTS.LANGUAGE, this.language.changeData({
          secondarySpellcheckerLanguage: lang
        }))
      }
    }
  }

  /* **************************************************************************/
  // Updating : App
  /* **************************************************************************/

  handleGlueCurrentUpdateChannel () {
    this.preventDefault()
    if (!this.app.hasSetUpdateChannel && pkg.releaseChannel !== AppSettings.UPDATE_CHANNELS.STABLE) {
      this.saveSettingsModel(SettingsIdent.SEGMENTS.APP, this.app.changeData({
        updateChannel: pkg.releaseChannel
      }))
    }
  }
}

export default alt.createStore(SettingsStore, STORE_NAME)
