import { Form, loc, createCallout, _, internal } from 'okta';
import FormInputFactory from './FormInputFactory';

const ErrorBanner = internal.views.forms.helpers.ErrorBanner;

export default Form.extend({

  layout: 'o-form-theme',
  className: 'ion-form',
  hasSavingState: true,
  autoSave: false,
  noCancelButton: true,
  title: 'Authenticate',
  save: loc('oform.next', 'login'),
  customSavingState: {start : 'formRequestStart', stop: 'formRequestRetrieved' },

  initialize: function () {
    const uiSchemas = this.getUISchema();
    const inputOptions = uiSchemas.map(FormInputFactory.create);

    //should be used before adding any other input components
    this.addCallouts();

    inputOptions.forEach(input => {
      this.addInputOrView(input);
    });

    this.listenTo(this, 'save', this.saveForm);
    this.listenTo(this.model, 'handleFormError', _.throttle(this.handleIonErrorResponses, 100, { trailing: false }));
  },

  saveForm(model) {
    //remove any existing warnings or messages before saving form
    this.$el.find('.o-form-error-container').empty();
    this.options.appState.trigger('saveForm', model);
  },

  getUISchema() {
    if (Array.isArray(this.options.currentViewState.uiSchema)) {
      return this.options.currentViewState.uiSchema;
    } else {
      return [];
    }
  },

  addInputOrView(input) {
    if (input.View) {
      this.add(input.View, {
        options: input.options
      });
    } else {
      this.addInput(input);
    }
  },

  addCallouts() {
    const warningMsgs = this.options.appState.get('messages');
    if (warningMsgs && warningMsgs.value.length) {
      const messageCallout = createCallout({
        content: warningMsgs.value[0].message,
        type: 'warning',
      });
      this.add(messageCallout, '.o-form-error-container');
    }
  },

  handleIonErrorResponses(model, res) {
    // console.log(model, res);
    // parse response, find field errors and global errors
    let inlineFieldValidationErrors = this.parseFieldErrors(res.responseJSON);
    let globalErrors = this.getGlobalErrors(res.responseJSON);
    let terminalErrors = this.getTerminalErrors(res.responseJSON);

    //show field validation errors by triggering `form:field-errors`, use errors[] object
    if (_.size(inlineFieldValidationErrors)) {
      _.each(inlineFieldValidationErrors, (errors, field) => {
        if(errors.length) {
          this.model.trigger('form:field-error', this.__errorFields[field] || field, _.map(errors, (err) => {
            return err;
          }), this);
        }
      });
    }

    //show top callout for all global errors
    if (globalErrors.length) {
      this.$('.o-form-error-container').addClass('o-form-has-errors');
      this.add(ErrorBanner, '.o-form-error-container', { options: { errorSummary: globalErrors.join(' ') } });
    }

    //show top callout for all terminal errors
    if (terminalErrors.length) {
      this.$('.o-form-error-container').addClass('o-form-has-errors');
      this.add(ErrorBanner, '.o-form-error-container', { options: { errorSummary: terminalErrors.join(' ') } });
    }    

    //trigger model resize

    //stop propagting `invalid error` so that __showErrors (from courage) won't execute
    // this.preventDefault();
  },

  getGlobalErrors(res) {
    let globalErrors = [];
    if (res.messages && res.messages.value) {
      _.each(res.messages.value, (value) => {
        globalErrors.push(value.message);
      });
    }

    return globalErrors;
  },

  getTerminalErrors(res) {
    let terminal = [];
    if (res.terminal && res.terminal.value.message) {
      _.each(res.terminal.value, (value) => {
        terminal.push(value.message);
      });
    }
    return terminal;
  },

  parseFieldErrors(res) {
    let errors = {};
    let remediationErrors = res.remediation && res.remediation.value[0] && _.omit(res.remediation.value[0].value, (value, key) => {
      return value.name === 'stateHandle';
    });

    if (remediationErrors) {
      _.each(remediationErrors, (remediationForm) => {
        if (remediationForm.form && remediationForm.form.value.length) {
          const formName = remediationForm.name;
          _.each(remediationForm.form.value, (field, key) => {
            const fieldName = `${formName}.${field.name}`;
            errors[fieldName] = [];
            if (field.messages && field.messages.value.length) {
              _.each(field.messages.value, (err) => {
                errors[fieldName].push(err.message);
              });
            }
          });
        }
      });
    }

    return errors;
  },

});
