GL.controller("TipCtrl",
  ["$scope", "$location", "$filter", "$http", "$interval", "$routeParams", "$uibModal", "Authentication", "RTip", "WBTip", "RTipExport", "RTipDownloadRFile", "RTipFileSourceGet", "WBTipFileSourceGet", "WBTipDownloadFile", "fieldUtilities", "RTipViewRFile", "RTipWBFileResource",
    function ($scope, $location, $filter, $http, $interval, $routeParams, $uibModal, Authentication, RTip, WBTip, RTipExport, RTipDownloadRFile, RTipFileSourceGet, WBTipFileSourceGet, WBTipDownloadFile, fieldUtilities, RTipViewRFile, RTipWBFileResource) {
      $scope.fieldUtilities = fieldUtilities;
      $scope.tip_id = $routeParams.tip_id;

      $scope.itemsPerPage = 5;
      $scope.currentCommentsPage = 1;
      $scope.currentMessagesPage = 1;

      $scope.answers = {};
      $scope.uploads = {};
      $scope.audiolist = {};

      $scope.showEditLabelInput = false;
      $scope.editMode = false

      $scope.mode = false;
      $scope.status = false
      $scope.openGrantTipAccessModal = function () {
        $http({
          method: "PUT", url: "api/user/operations", data: {
            "operation": "get_users_names",
            "args": {}
          }
        }).then(function (response) {
          $uibModal.open({
            templateUrl: "views/modals/grant_access.html",
            controller: "ConfirmableModalCtrl",
            resolve: {
              arg: {
                users_names: response.data
              },
              confirmFun: function () {
                return function (receiver_id) {
                  var req = {
                    operation: "grant",
                    args: {
                      receiver: receiver_id
                    },
                  };
                  return $http({ method: "PUT", url: "api/rtips/" + $scope.tip.id, data: req }).then(function () {
                    $scope.reload();
                  });
                };
              },
              cancelFun: null
            }
          });
        });
      };

      $scope.openRevokeTipAccessModal = function () {
        $http({
          method: "PUT", url: "api/user/operations", data: {
            "operation": "get_users_names",
            "args": {}
          }
        }).then(function (response) {
          $uibModal.open({
            templateUrl: "views/modals/revoke_access.html",
            controller: "ConfirmableModalCtrl",
            resolve: {
              arg: {
                users_names: response.data
              },
              confirmFun: function () {
                return function (receiver_id) {
                  var req = {
                    operation: "revoke",
                    args: {
                      receiver: receiver_id
                    }
                  };

                  return $http({ method: "PUT", url: "api/rtips/" + $scope.tip.id, data: req }).then(function () {
                    $scope.reload();
                  });
                };
              },
              cancelFun: null
            }
          });
        });
      };

      $scope.getAnswersEntries = function (entry) {
        if (typeof entry === "undefined") {
          return $scope.answers[$scope.field.id];
        }

        return entry[$scope.field.id];
      };



      var filterNotTriggeredField = function (parent, field, answers) {
        var i;
        if (fieldUtilities.isFieldTriggered(parent, field, answers, $scope.tip.score)) {
          for (i = 0; i < field.children.length; i++) {
            filterNotTriggeredField(field, field.children[i], answers);
          }
        }
      };

      $scope.preprocessTipAnswers = function (tip) {
        var x, i, j, k, questionnaire, step;

        for (x = 0; x < tip.questionnaires.length; x++) {
          questionnaire = tip.questionnaires[x];
          $scope.fieldUtilities.parseQuestionnaire(questionnaire, {});

          for (i = 0; i < questionnaire.steps.length; i++) {
            step = questionnaire.steps[i];
            if (fieldUtilities.isFieldTriggered(null, step, questionnaire.answers, $scope.tip.score)) {
              for (j = 0; j < step.children.length; j++) {
                filterNotTriggeredField(step, step.children[j], questionnaire.answers);
              }
            }
          }

          for (i = 0; i < questionnaire.steps.length; i++) {
            step = questionnaire.steps[i];
            j = step.children.length;
            while (j--) {
              if (step.children[j]["template_id"] === "whistleblower_identity") {
                $scope.whistleblower_identity_field = step.children[j];
                $scope.whistleblower_identity_field.enabled = true;
                step.children.splice(j, 1);
                $scope.questionnaire = {
                  steps: [angular.copy($scope.whistleblower_identity_field)]
                };

                $scope.fields = $scope.questionnaire.steps[0].children;
                $scope.rows = fieldUtilities.splitRows($scope.fields);

                fieldUtilities.onAnswersUpdate($scope);

                for (k = 0; k < $scope.whistleblower_identity_field.children.length; k++) {
                  filterNotTriggeredField($scope.whistleblower_identity_field, $scope.whistleblower_identity_field.children[k], $scope.tip.data.whistleblower_identity);
                }
              }
            }
          }
        }
      };

      $scope.hasMultipleEntries = function (field_answer) {
        return (typeof field_answer !== "undefined") && field_answer.length > 1;
      };

      $scope.filterFields = function (field) {
        return field.type !== "fileupload";
      };

      if ($scope.Authentication.session.role === "whistleblower") {
        $scope.fileupload_url = "api/wbtip/rfile";

        $scope.tip = new WBTip(function (tip) {
          $scope.tip = tip;
          $scope.tip.context = $scope.contexts_by_id[$scope.tip.context_id];
          $scope.tip.receivers_by_id = $scope.Utils.array_to_map($scope.tip.receivers);
          $scope.score = $scope.tip.score;

          $scope.loadRFile = WBTipFileSourceGet;
          $scope.fetchAudioFiles()

          $scope.ctx = "wbtip";
          $scope.preprocessTipAnswers(tip);

          $scope.tip.submissionStatusStr = $scope.Utils.getSubmissionStatusText($scope.tip.status, $scope.tip.substatus, $scope.submission_statuses);

          $scope.downloadWBFile = function (file) {
            WBTipDownloadFile(file);
          };

          // FIXME: remove this variable that is now needed only to map wb_identity_field
          $scope.submission = {};
          $scope.submission._submission = tip;

          $scope.provideIdentityInformation = function (identity_field_id, identity_field_answers) {
            for (var key in $scope.uploads) {
              if ($scope.uploads[key]) {
                $scope.uploads[key].resume();
              }
            }

            $scope.interval = $interval(function () {
              for (var key in $scope.uploads) {
                if ($scope.uploads[key] &&
                  $scope.uploads[key].isUploading() &&
                  $scope.uploads[key].isUploading()) {
                  return;
                }
              }

              $interval.cancel($scope.interval);

              return $http.post("api/wbtip/" + $scope.tip.id + "/provideidentityinformation",
                { "identity_field_id": identity_field_id, "identity_field_answers": identity_field_answers }).
                then(function () {
                  $scope.reload();
                });

            }, 1000);
          };

          if (tip.receivers.length === 1 && tip.msg_receiver_selected === null) {
            tip.msg_receiver_selected = tip.msg_receivers_selector[0].key;
          }
        });

      } else if ($scope.Authentication.session.role === "receiver") {
        $scope.tip = new RTip({ id: $scope.tip_id }, function (tip) {
          $scope.tip = tip;
          $scope.fetchAudioFiles()
          $scope.tip.context = $scope.contexts_by_id[$scope.tip.context_id];
          $scope.tip.receivers_by_id = $scope.Utils.array_to_map($scope.tip.receivers);
          $scope.score = $scope.tip.score;
          $scope.ctx = "rtip";
          $scope.preprocessTipAnswers(tip);
          $scope.exportTip = RTipExport;
          $scope.downloadRFile = RTipDownloadRFile;
          $scope.loadRFile = RTipFileSourceGet;
          $scope.viewRFile = RTipViewRFile;
          $scope.show = function (id) {
            return !!$scope.tip.masking.find(mask => mask.content_id === id);
          }
          var reloadUI = function () { $scope.reload(); };
          $scope.deleteWBFile = function (f) {
            let maskingObjects = $scope.tip.masking.filter(function (masking) {
              return masking.content_id === f.id;
            });
            if (maskingObjects.length !== 0) {
              return $http({
                method: "DELETE",
                url: "api/rtips/" + tip.id + "/delete/maskingfile/" + maskingObjects[0].id
              }).then(reloadUI);
            }
          };
          $scope.unmaskFile = function (f) {
            let maskingObjects = $scope.tip.masking.filter(function (masking) {
              return masking.content_id === f.id;
            });
            if (maskingObjects.length !== 0) {
              return $http({
                method: "DELETE",
                url: "api/rtips/" + tip.id + "/masking/" + maskingObjects[0].id
              }).then(reloadUI);
            }
          };
          $scope.masking = function (id) {
            $scope.status = true
            var maskingdata = {
              content_id: id,
              permanent_masking: [],
              temporary_masking: { fileMaskingStatus: $scope.status }
            }
            $scope.tip.newMasking(maskingdata);
          }
          $scope.showEditLabelInput = $scope.tip.label === "";
          $scope.tip.submissionStatusStr = $scope.Utils.getSubmissionStatusText($scope.tip.status, $scope.tip.substatus, $scope.submission_statuses);
          $scope.supportedViewTypes = ["application/pdf", "audio/mpeg", "image/gif", "image/jpeg", "image/png", "text/csv", "text/plain", "video/mp4"];

        });
      }

      $scope.editLabel = function () {
        $scope.showEditLabelInput = true;
      };

      $scope.markReportStatus = function (date) {
        var report_date = new Date(date);
        var current_date = new Date();
        return current_date > report_date;
      };
      $scope.permanentMaskingObjects = []
      $scope.maskingObjects = []
      function permanentRefineContent(content, permanentMaskingObjects) {
        var refinedContent = content;
        permanentMaskingObjects.forEach(function (obj) {
          var start = obj.start;
          var end = obj.end;
          var stars = String.fromCharCode(0x2588).repeat(end - start + 1);
          var insertPosition = start;
          refinedContent = refinedContent.substring(0, insertPosition) + stars + refinedContent.substring(insertPosition);
        });
        return refinedContent;
      }
      $scope.edited = function (id) {
        $scope.maskingObjects = $scope.tip.masking.filter(function (masking) {
          return masking.content_id === id;
        });
        if ($scope.maskingObjects.length !== 0 && $scope.maskingObjects[0].permanent_masking.length > 0) {
          return true
        } else {
          return false
        }
      }
      $scope.maskingContent = function (content, id) {
        $scope.permanentMaskingObjects = $scope.tip.masking.filter(function (masking) {
          return masking.content_id === id;
        });
        if ($scope.permanentMaskingObjects.length !== 0 && $scope.permanentMaskingObjects[0].permanent_masking.length > 0) {
          var permanentMaskingArray = Object.values($scope.permanentMaskingObjects[0].permanent_masking);
          permanentMaskingArray.sort(function (a, b) {
            return a.start - b.start;
          });
          var contentData = permanentRefineContent(content, permanentMaskingArray);
          return contentData
        } else {
          return content
        }
      }
      $scope.updateLabel = function (label) {
        $scope.tip.operation("set", { "key": "label", "value": label }).then(function () {
          $scope.showEditLabelInput = false;
        });
      };

      $scope.updateSubmissionStatus = function () {
        $scope.tip.updateSubmissionStatus().then(function () {
          $scope.tip.submissionStatusStr = $scope.Utils.getSubmissionStatusText($scope.tip.status, $scope.tip.substatus, $scope.submission_statuses);
        });
      };

      $scope.fetchAudioFiles = function () {
        for (let dictionary of $scope.tip.rfiles) {
          $scope.audiolist[dictionary['reference']] = {}
          $scope.audiolist[dictionary['reference']]['key'] = dictionary;
          $scope.audiolist[dictionary['reference']]['value'] = null;
        }
      };

      $scope.newComment = function () {
        $scope.tip.newComment($scope.tip.newCommentContent);
        $scope.tip.newCommentContent = "";
      };

      $scope.newMessage = function () {
        $scope.tip.newMessage($scope.tip.newMessageContent);
        $scope.tip.newMessageContent = "";
      };

      $scope.tip_toggle_star = function () {
        return $scope.tip.operation("set", { "key": "important", "value": !$scope.tip.important }).then(function () {
          $scope.tip.important = !$scope.tip.important;
        });
      };

      $scope.tip_notify = function (enable) {
        return $scope.tip.operation("set", { "key": "enable_notifications", "value": enable }).then(function () {
          $scope.tip.enable_notifications = enable;
        });
      };

      $scope.tip_delete = function () {
        $uibModal.open({
          templateUrl: "views/modals/delete_confirmation.html",
          controller: "TipOperationsCtrl",
          resolve: {
            args: function () {
              return {
                tip: $scope.tip,
                operation: "delete"
              };
            }
          }
        });
      };

      $scope.tip_postpone = function () {
        $uibModal.open({
          templateUrl: "views/modals/tip_operation_postpone.html",
          controller: "TipOperationsCtrl",
          resolve: {
            args: function () {
              return {
                tip: $scope.tip,
                operation: "postpone",
                contexts_by_id: $scope.contexts_by_id,
                expiration_date: $scope.Utils.getPostponeDate($scope.contexts_by_id[$scope.tip.context_id].tip_timetolive),
                dateOptions: {
                  minDate: new Date($scope.tip.expiration_date),
                  maxDate: $scope.Utils.getPostponeDate(Math.max(365, $scope.contexts_by_id[$scope.tip.context_id].tip_timetolive * 2))
                },
                opened: false,
                Utils: $scope.Utils
              };
            }
          }
        });
      };

      $scope.set_reminder = function () {
        $uibModal.open({
          templateUrl: "views/modals/tip_operation_set_reminder.html",
          controller: "TipOperationsCtrl",
          resolve: {
            args: function () {
              return {
                tip: $scope.tip,
                operation: "set_reminder",
                contexts_by_id: $scope.contexts_by_id,
                reminder_date: $scope.Utils.getPostponeDate($scope.contexts_by_id[$scope.tip.context_id].tip_reminder),
                dateOptions: {
                  minDate: new Date($scope.tip.creation_date)
                },
                opened: false,
                Utils: $scope.Utils
              };
            }
          }
        });
      };
      $scope.editReport = function (content, id, type) {
        $uibModal.open({
          templateUrl: "views/modals/report_reduct.html",
          controller: "TipEditReportCtrl",
          resolve: {
            args: function () {
              return {
                tip: $scope.tip,
                operation: "editReport",
                contexts_by_id: $scope.contexts_by_id,
                reminder_date: $scope.Utils.getPostponeDate($scope.contexts_by_id[$scope.tip.context_id].tip_reminder),
                dateOptions: {
                  minDate: new Date($scope.tip.creation_date)
                },
                opened: false,
                Utils: $scope.Utils,
                data: { content, id, type }
              };
            }
          }
        });
      };
      $scope.tip_mode = function (value) {
        $scope.mode = value;
      }
      $scope.tip_open_additional_questionnaire = function () {
        $scope.answers = {};
        $scope.uploads = {};
        $uibModal.open({
          templateUrl: "views/modals/tip_additional_questionnaire_form.html",
          controller: "AdditionalQuestionnaireCtrl",
          scope: $scope
        });
      };
      $scope.access_identity = function () {
        return $http.post("api/rtips/" + $scope.tip.id + "/iars", { "request_motivation": "" }).then(function () {
          $scope.reload();
        });
      };
      $scope.file_identity_access_request = function () {
        $uibModal.open({
          templateUrl: "views/modals/tip_operation_file_identity_access_request.html",
          controller: "IdentityAccessRequestCtrl",
          resolve: {
            tip: function () {
              return $scope.tip;
            }
          }
        });
      };

      $scope.score = 0;

      $scope.$watch("answers", function () {
        fieldUtilities.onAnswersUpdate($scope);
      }, true);

      $scope.$on("GL::uploadsUpdated", function () {
        fieldUtilities.onAnswersUpdate($scope);
      });



    }]).
  controller("TipOperationsCtrl",
    ["$scope", "$http", "$location", "$uibModalInstance", "args",
      function ($scope, $http, $location, $uibModalInstance, args) {
        $scope.args = args;

        $scope.cancel = function () {
          $uibModalInstance.close();
        };

        $scope.disable_reminder = function () {
          $uibModalInstance.close();
          var req = {
            "operation": "set_reminder",
            "args": {
              "value": 32503680000000
            }
          };

          return $http({ method: "PUT", url: "api/rtips/" + args.tip.id, data: req }).then(function () {
            $scope.reload();
          });
        };

        $scope.confirm = function () {
          $uibModalInstance.close();

          if ($scope.args.operation === "postpone" || $scope.args.operation === "set_reminder") {
            var date;
            if ($scope.args.operation === "postpone")
              date = $scope.args.expiration_date.getTime();
            else
              date = $scope.args.reminder_date.getTime();

            var req = {
              "operation": $scope.args.operation,
              "args": {
                "value": date
              }
            };

            return $http({ method: "PUT", url: "api/rtips/" + args.tip.id, data: req }).then(function () {
              $scope.reload();
            });
          } else if (args.operation === "delete") {
            return $http({ method: "DELETE", url: "api/rtips/" + args.tip.id, data: {} }).
              then(function () {
                $location.url("/recipient/reports");
                $scope.reload();
              });
          }
        };
      }]).
  controller("RTipWBFileUploadCtrl", ["$scope", "Authentication", "RTipDownloadWBFile", "RTipWBFileResource", function ($scope, Authentication, RTipDownloadWBFile, RTipWBFileResource) {
    var reloadUI = function () { $scope.reload(); };

    $scope.downloadWBFile = function (f) {
      RTipDownloadWBFile(f);
    };

    $scope.deleteWBFile = function (f) {
      RTipWBFileResource.remove({ "id": f.id }).$promise.finally(reloadUI);
    };
  }]).
  controller("WBTipFileDownloadCtrl", ["$scope", "$uibModalInstance", "WBTipDownloadFile", "file", "tip", function ($scope, $uibModalInstance, WBTipDownloadFile, file, tip) {
    $scope.ctx = "download";
    $scope.file = file;
    $scope.tip = tip;
    $scope.confirm = function () {
      $uibModalInstance.close();
      WBTipDownloadFile(file);
    };

    $scope.cancel = function () {
      $uibModalInstance.close();
    };
  }]).
  controller("IdentityAccessRequestCtrl",
    ["$scope", "$http", "$uibModalInstance", "tip",
      function ($scope, $http, $uibModalInstance, tip) {
        $scope.tip = tip;

        $scope.cancel = function () {
          $uibModalInstance.close();
        };

        $scope.confirm = function () {
          $uibModalInstance.close();

          return $http.post("api/rtips/" + tip.id + "/iars", { "request_motivation": $scope.request_motivation }).
            then(function () {
              $scope.reload();
            });
        };
      }]).
  controller("WhistleblowerFilesCtrl", ["$scope", function ($scope) {
    $scope.uploads = {};
  }]).
  controller("WhistleblowerIdentityFormCtrl", ["$scope", function ($scope) {
    $scope.uploads = {};
  }]).controller("TipEditReportCtrl", ["$scope", "$uibModalInstance", "args", "Authentication", "$routeParams", "$http",
    function ($scope, $uibModalInstance, args, Authentication, $routeParams, $http) {
      $scope.cancel = function () {
        $uibModalInstance.close();
      };
      $scope.args = args;
      $scope.content = $scope.args.data.content;
      $scope.contentId = $scope.args.data.id
      $scope.contentType = $scope.args.data.type
      var i = 0;
      $scope.ranges = {};
      $scope.overlapRanges = {};
      $scope.id = $routeParams.tip_id;
      $scope.reductCondition = false;
      $scope.maskingObjects = []
      $scope.permanentMaskingObjects = []
      $scope.temporaryRanges = []
      $scope.overlapRemoveRanges = []
      $scope.temperaryMaskingContent = ''
      $scope.permanentMaskingContent = ''
      $scope.maskingSwitch = true;
      $scope.toggle = true



      $scope.maskingObjects = $scope.args.tip.masking.filter(function (masking) {
        return masking.content_id === $scope.contentId;
      });
      if ($scope.maskingObjects.length !== 0 && $scope.maskingObjects[0].permanent_masking.length > 0) {
        var permanentMaskingArray = Object.values($scope.maskingObjects[0].permanent_masking);
        permanentMaskingArray.sort(function (a, b) {
          return a.start - b.start;
        });
        $scope.content = permanentRefineContent($scope.content, permanentMaskingArray);
        $scope.permanentMaskingContent = $scope.content;
      } else {
        $scope.permanentMaskingContent = $scope.args.data.content;
      }
      $scope.maskingObjects.forEach(function (maskingObject) {
        $scope.content = applyTemporaryMasking($scope.content, maskingObject.temporary_masking);
        $scope.temperaryMaskingContent = $scope.content;
      });
      if ($scope.maskingObjects.length !== 0 && $scope.maskingObjects[0].temporary_masking.length > 0) {
        $scope.temporaryRanges = [...$scope.maskingObjects[0].temporary_masking];
        $scope.overlapRemoveRanges = [...$scope.maskingObjects[0].temporary_masking];
      }
      function permanentRefineContent(content, permanentMaskingObjects) {
        var refinedContent = content;
        permanentMaskingObjects.forEach(function (obj) {
          var start = obj.start;
          var end = obj.end;
          var stars = String.fromCharCode(0x2588).repeat(end - start + 1);
          var insertPosition = start;
          refinedContent = refinedContent.substring(0, insertPosition) + stars + refinedContent.substring(insertPosition);
        });
        return refinedContent;
      }
      function applyTemporaryMasking(content, temporaryMasking) {
        let modifiedContent = content;
        for (let range in temporaryMasking) {
          if (temporaryMasking.hasOwnProperty(range)) {
            let start = temporaryMasking[range].start;
            let end = temporaryMasking[range].end;
            modifiedContent =
              modifiedContent.substring(0, start) +
              String.fromCharCode(0x2591).repeat(end - start + 1) +
              modifiedContent.substring(end + 1);
          }
        }
        return modifiedContent;
      }
      function isRangeInTemporaryRanges(start, end, temporary_ranges) {
        for (let i = 0; i < temporary_ranges.length; i++) {
          const range = temporary_ranges[i];
          if (start >= range.start && end <= range.end) {
            return true;
          }
        }
        return false;
      }
      $scope.mask = function (id) {
        var blank = String.fromCharCode(42);
        var elem = document.getElementById(id);
        var text = elem.value;
        var start = elem.selectionStart;
        var finish = elem.selectionEnd;
        // temperary function
        if ((!$scope.resources.preferences.can_privilege_delete_mask_information) && ($scope.resources.preferences.can_privilege_mask_information)) {
          temperarySelect(start, finish, blank, text, elem)
        }
        // permananet function
        if ((!$scope.resources.preferences.can_privilege_mask_information) && ($scope.resources.preferences.can_privilege_delete_mask_information)) {
          if ($scope.maskingObjects.length > 0 && $scope.maskingObjects[0].temporary_masking.length > 0) {
            permamentSelect(start, finish, blank, text, elem)
          }
        }
        // both function
        if (($scope.resources.preferences.can_privilege_mask_information) && ($scope.resources.preferences.can_privilege_delete_mask_information)) {
          if ($scope.toggle) {
            temperarySelect(start, finish, blank, text, elem)
          }
          if (!$scope.toggle) {
            if ($scope.maskingObjects.length > 0 && $scope.maskingObjects[0].temporary_masking.length > 0) {
              permamentSelect(start, finish, blank, text, elem)
            }
          }

        }

      }
      $scope.UnSelect = function (id) {
        var elem = document.getElementById(id);
        var text = elem.value;
        var start = elem.selectionStart;
        var finish = elem.selectionEnd;
        // temperay 
        if ((!$scope.resources.preferences.can_privilege_delete_mask_information) && ($scope.resources.preferences.can_privilege_mask_information)) {
          temperaryUnselect(start, finish, text, elem)
        }
        // permanent
        if ((!$scope.resources.preferences.can_privilege_mask_information) && ($scope.resources.preferences.can_privilege_delete_mask_information)) {
          if (($scope.maskingObjects.length > 0) && ($scope.maskingObjects[0].temporary_masking.length > 0)) {
            permamentUnselect(start, finish, text, elem)
          }
        }
        // both 
        if (($scope.resources.preferences.can_privilege_mask_information) && ($scope.resources.preferences.can_privilege_delete_mask_information)) {
          if ($scope.toggle) {
            temperaryUnselect(start, finish, text, elem)
          }
          if (!$scope.toggle) {
            if (($scope.maskingObjects.length > 0) && ($scope.maskingObjects[0].temporary_masking.length > 0)) {
              permamentUnselect(start, finish, text, elem)
            }
          }
        }


      };
      function updateRanges(ranges, start, end) {
        const updatedRanges = {};
        let newKey = 0;

        Object.keys(ranges).forEach((key) => {
          const range = ranges[key];

          if (range.end < start || range.start > end) {
            updatedRanges[newKey.toString()] = range;
            newKey++;
          } else {
            if (range.start < start) {
              updatedRanges[newKey.toString()] = {
                start: range.start,
                end: start - 1,
              };
              newKey++;
            }
            if (range.end > end) {
              updatedRanges[newKey.toString()] = {
                start: end + 1,
                end: range.end,
              };
              newKey++;
            }
          }
        });
        const filteredRanges = {};
        for (const key in updatedRanges) {
          if (updatedRanges.hasOwnProperty(key) && updatedRanges[key] !== null && updatedRanges[key] !== undefined && Object.keys(updatedRanges[key]).length > 0) {
            filteredRanges[key] = updatedRanges[key];
          }
        }

        return filteredRanges;
      }
      function mergeRanges(ranges) {
        var mergedRanges = [];
        var keys = Object.keys(ranges);
        keys.sort(function (a, b) {
          return ranges[a].start - ranges[b].start;
        });
        var currentRange = ranges[keys[0]];
        for (var i = 1; i < keys.length; i++) {
          var nextRange = ranges[keys[i]];
          if (nextRange.start <= currentRange.end + 1) {
            currentRange.end = Math.max(currentRange.end, nextRange.end);
          } else {
            mergedRanges.push(currentRange);
            currentRange = nextRange;
          }
        }
        mergedRanges.push(currentRange);
        return mergedRanges;
      }
      $scope.saveMasking = function () {
        // For Temperary
        if ((!$scope.resources.preferences.can_privilege_delete_mask_information) && ($scope.resources.preferences.can_privilege_mask_information)) {
          temperarySave()
        }
        // For permament
        if ((!$scope.resources.preferences.can_privilege_mask_information) && ($scope.resources.preferences.can_privilege_delete_mask_information) && ($scope.maskingObjects.length !== 0) && ($scope.maskingObjects[0].temporary_masking.length > 0)) {
          permamentSave()
        }
        // both
        if (($scope.resources.preferences.can_privilege_mask_information) && ($scope.resources.preferences.can_privilege_delete_mask_information)) {
          if ($scope.toggle) {
            temperarySave()
          }
          if (!$scope.toggle) {
            permamentSave()
          }
        }
      }
      function findMissingRanges(oldRanges, newRanges) {
        const missingRanges = [];

        for (const oldRange of oldRanges) {
          for (let i = oldRange.start; i <= oldRange.end; i++) {
            let found = false;

            for (const newRange of newRanges) {
              if (i >= newRange.start && i <= newRange.end) {
                found = true;
                break;
              }
            }

            if (!found) {
              if (missingRanges.length > 0) {
                const lastMissingRange = missingRanges[missingRanges.length - 1];
                if (i === lastMissingRange.end + 1) {
                  lastMissingRange.end = i;
                } else {
                  missingRanges.push({ start: i, end: i });
                }
              } else {
                missingRanges.push({ start: i, end: i });
              }
            }
          }
        }

        return missingRanges;
      }
      $scope.toggleMasking = function (maskingSwitch, id) {
        $scope.toggle = maskingSwitch;
        document.getElementById(id).value = $scope.content
        $scope.ranges = {}
        $scope.overlapRanges = {};
        $scope.temporaryRanges = []
        $scope.temporaryRanges = [...$scope.maskingObjects[0].temporary_masking]
        $scope.overlapRemoveRanges = []
        $scope.overlapRemoveRanges = [...$scope.maskingObjects[0].temporary_masking];
      };
      function filterRanges(ranges) {
        return ranges.filter((range) => {
          return range !== null && range !== undefined && Object.keys(range).length > 0;
        });
      }
      function temperarySelect(start, finish, blank, text, elem) {
        var length = finish - start;
        if (length) {
          elem.value = text.substring(0, start) + blank.repeat(length) + text.substring(finish, text.length);
        }
        if ($scope.maskingObjects.length > 0 && $scope.maskingObjects[0].temporary_masking.length > 0) {
          var overlapsTemporaryMasking = $scope.maskingObjects[0].temporary_masking.some(function (range) {
            return (start >= range.start && start <= range.end) || (finish - 1 >= range.start && finish - 1 <= range.end);
          });
          if (overlapsTemporaryMasking) {
            var isOverlapRanges = isRangeInTemporaryRanges(start, finish - 1, $scope.temporaryRanges)
            if (isOverlapRanges) {
              var range = {
                start: start,
                end: finish - 1
              };
              $scope.overlapRanges[i++] = range;
              $scope.overlapRemoveRanges = mergeRanges($scope.overlapRemoveRanges);
              if ($scope.overlapRemoveRanges.length > 0) {
                $scope.overlapRemoveRanges = $scope.overlapRemoveRanges.filter(function (range) {
                  return range !== null && range !== undefined && Object.keys(range).length > 0;
                });
                const ranges = updateRanges($scope.overlapRemoveRanges, start, finish - 1);
                $scope.overlapRemoveRanges = []
                for (const key in ranges) {
                  if (ranges.hasOwnProperty(key)) {
                    $scope.overlapRemoveRanges.push(ranges[key]);
                  }
                }
              }
            }
          }
        }

        var rangeExists = Object.values($scope.ranges).some(function (range) {
          return range.start === start && range.end === finish;
        });
        var indicesEqual = start === finish;
        if (!rangeExists && !indicesEqual) {
          var range = {
            start: start,
            end: finish - 1
          };
          $scope.ranges[i++] = range;
        }
      }
      function permamentSelect(start, finish, blank, text, elem) {
        var overlapsTemporaryMasking = $scope.maskingObjects[0].temporary_masking.some(function (range) {
          return (start >= range.start && start <= range.end) || (finish - 1 >= range.start && finish - 1 <= range.end);
        });

        if (overlapsTemporaryMasking) {
          var length = finish - start;
          if (length) {
            elem.value = text.substring(0, start) + blank.repeat(length) + text.substring(finish, text.length);
          }
          var isOverlapRanges = isRangeInTemporaryRanges(start, finish - 1, $scope.temporaryRanges)
          if (isOverlapRanges) {
            var range = {
              start: start,
              end: finish - 1
            };
            $scope.overlapRanges[i++] = range;
            $scope.overlapRemoveRanges = mergeRanges($scope.overlapRemoveRanges);
            if ($scope.overlapRemoveRanges.length > 0) {
              $scope.overlapRemoveRanges = $scope.overlapRemoveRanges.filter(function (range) {
                return range !== null && range !== undefined && Object.keys(range).length > 0;
              });
              const ranges = updateRanges($scope.overlapRemoveRanges, start, finish - 1);
              $scope.overlapRemoveRanges = []
              for (const key in ranges) {
                if (ranges.hasOwnProperty(key)) {
                  $scope.overlapRemoveRanges.push(ranges[key]);
                }
              }
            }
          }
          else {
            var rangeExists = Object.values($scope.temporaryRanges).some(function (range) {
              return range.start === start && range.end === finish;
            });
            var indicesEqual = start === finish;
            if (!rangeExists && !indicesEqual) {
              var range = {
                start: start,
                end: finish - 1
              };
              $scope.temporaryRanges[i++] = range;
            }
          }
        }
      }
      function temperaryUnselect(start, finish, text, elem) {
        if (!angular.equals({}, $scope.ranges) && ($scope.maskingObjects.length > 0) && ($scope.maskingObjects[0].temporary_masking.length > 0)) {
          var overlapsTemporaryMasking = $scope.maskingObjects[0].temporary_masking.some(function (range) {
            return (start >= range.start && start <= range.end) || (finish - 1 >= range.start && finish - 1 <= range.end);
          });

          if (!overlapsTemporaryMasking) {
            var length = finish - start;
            if (length) {
              elem.value = text.substring(0, start) + $scope.content.substring(start, finish) + text.substring(finish, text.length);
              $scope.ranges = mergeRanges($scope.ranges);
              $scope.ranges = updateRanges($scope.ranges, start, finish - 1)
            }
          } else {
            var isOverlapRanges = Object.keys($scope.overlapRanges).some(function (key) {
              var range = $scope.overlapRanges[key];
              return (start >= range.start && start <= range.end) || (finish - 1 >= range.start && finish - 1 <= range.end);
            });
            var isOverlapRemoveRanges = Object.keys($scope.overlapRemoveRanges).some(function (key) {
              var range = $scope.overlapRemoveRanges[key];
              return (start >= range.start && start <= range.end) || (finish - 1 >= range.start && finish - 1 <= range.end);
            });
            if (isOverlapRanges && !isOverlapRemoveRanges) {
              elem.value = text.substring(0, start) + $scope.temperaryMaskingContent.substring(start, finish) + text.substring(finish, text.length);
              $scope.overlapRanges = mergeRanges($scope.overlapRanges);
              $scope.overlapRanges = updateRanges($scope.overlapRanges, start, finish - 1);
              var range = {
                start: start,
                end: finish - 1
              };
              $scope.overlapRemoveRanges[i++] = range;
              $scope.overlapRemoveRanges = mergeRanges($scope.overlapRemoveRanges);
            }
          }
        }
        else {

          if (!angular.equals({}, $scope.ranges)) {
            var length = finish - start;
            if (length) {
              elem.value = text.substring(0, start) + $scope.content.substring(start, finish) + text.substring(finish, text.length);
              $scope.ranges = mergeRanges($scope.ranges);
              $scope.ranges = updateRanges($scope.ranges, start, finish - 1)
            }
          }
        }
      }
      function permamentUnselect(start, finish, text, elem) {
        var overlapsTemporaryMasking = $scope.maskingObjects[0].temporary_masking.some(function (range) {
          return (start >= range.start && start <= range.end) || (finish - 1 >= range.start && finish - 1 <= range.end);
        });
        if (overlapsTemporaryMasking) {
          var length = finish - start;
          if (length) {
            var isOverlapRanges = Object.keys($scope.overlapRanges).some(function (key) {
              var range = $scope.overlapRanges[key];
              return (start >= range.start && start <= range.end) || (finish - 1 >= range.start && finish - 1 <= range.end);
            });
            var isTemporaryRanges = Object.keys($scope.temporaryRanges).some(function (key) {
              var range = $scope.temporaryRanges[key];
              return (start >= range.start && start <= range.end) || (finish - 1 >= range.start && finish - 1 <= range.end);
            });
            var isOverlapRemoveRanges = Object.keys($scope.overlapRemoveRanges).some(function (key) {
              var range = $scope.overlapRemoveRanges[key];
              return (start >= range.start && start <= range.end) || (finish - 1 >= range.start && finish - 1 <= range.end);
            });
            if (isOverlapRanges && !isOverlapRemoveRanges) {
              elem.value = text.substring(0, start) + $scope.temperaryMaskingContent.substring(start, finish) + text.substring(finish, text.length);
              $scope.overlapRanges = mergeRanges($scope.overlapRanges);
              $scope.overlapRanges = updateRanges($scope.overlapRanges, start, finish - 1);
              var range = {
                start: start,
                end: finish - 1
              };
              $scope.overlapRemoveRanges[i++] = range;
              $scope.overlapRemoveRanges = mergeRanges($scope.overlapRemoveRanges);
            }
            if (!isOverlapRanges && isTemporaryRanges) {
              elem.value = text.substring(0, start) + $scope.permanentMaskingContent.substring(start, finish) + text.substring(finish, text.length);
              $scope.temporaryRanges = mergeRanges($scope.temporaryRanges);
              if ($scope.temporaryRanges.length > 0) {
                $scope.temporaryRanges = $scope.temporaryRanges.filter(function (range) {
                  return range !== null && range !== undefined && Object.keys(range).length > 0;
                });
                const ranges = updateRanges($scope.temporaryRanges, start, finish - 1);
                $scope.temporaryRanges = []
                for (const key in ranges) {
                  if (ranges.hasOwnProperty(key)) {
                    $scope.temporaryRanges.push(ranges[key]);
                  }
                }
              }
            }
            if (isOverlapRanges && isTemporaryRanges) {
              elem.value = text.substring(0, start) + $scope.permanentMaskingContent.substring(start, finish) + text.substring(finish, text.length);
              elem.value = applyTemporaryMasking(elem.value, $scope.overlapRanges)
              $scope.temporaryRanges = mergeRanges($scope.temporaryRanges);
              if ($scope.temporaryRanges.length > 0) {
                $scope.temporaryRanges = $scope.temporaryRanges.filter(function (range) {
                  return range !== null && range !== undefined && Object.keys(range).length > 0;
                });
                const ranges = updateRanges($scope.temporaryRanges, start, finish - 1);
                $scope.temporaryRanges = []
                for (const key in ranges) {
                  if (ranges.hasOwnProperty(key)) {
                    $scope.temporaryRanges.push(ranges[key]);
                  }
                }
              }
              $scope.temporaryRanges = filterRanges($scope.temporaryRanges)
              $scope.temporaryRanges = [...Object.values($scope.overlapRanges)]
              $scope.overlapRanges = mergeRanges($scope.overlapRanges);
              $scope.overlapRanges = updateRanges($scope.overlapRanges, start, finish - 1);
              var range = {
                start: start,
                end: finish - 1
              };
              $scope.overlapRemoveRanges[i++] = range;
              $scope.overlapRemoveRanges = mergeRanges($scope.overlapRemoveRanges);
            }
          }
        }
      }
      function permamentSave() {
        if ($scope.maskingObjects.length > 0 && $scope.maskingObjects[0].permanent_masking.length == 0 && $scope.temporaryRanges == 0) {
          var reloadUI = function () { $scope.reload(); };
          return $http({
            method: "DELETE",
            url: "api/rtips/" + $scope.args.tip.id + "/masking/" + $scope.maskingObjects[0].id
          }).then(reloadUI, $uibModalInstance.close());
        } else {
          $scope.temporaryRanges = mergeRanges($scope.temporaryRanges)
          $scope.temporaryRanges = filterRanges($scope.temporaryRanges)
          if ($scope.temporaryRanges.length > 0) {
            var missingRanges = findMissingRanges($scope.maskingObjects[0].temporary_masking, $scope.temporaryRanges);
            let maskingdata = {
              content_id: $scope.contentId,
              content_type: $scope.contentType,
              missing_ranges: missingRanges,
              temporary_masking: $scope.temporaryRanges
            };
            console.log(maskingdata, "permanent maskingdata");
            $scope.args.tip.updateMasking($scope.maskingObjects[0].id, maskingdata);
            $uibModalInstance.close();
          }
          else {
            var missingRanges = $scope.maskingObjects[0].temporary_masking;
            let maskingdata = {
              content_id: $scope.contentId,
              content_type: $scope.contentType,
              missing_ranges: missingRanges,
              temporary_masking: []
            };
            console.log(maskingdata, "permanent maskingdata");
            $scope.args.tip.updateMasking($scope.maskingObjects[0].id, maskingdata);
            $uibModalInstance.close();
          }
        }
      }
      function temperarySave() {
        if ($scope.maskingObjects.length > 0) {
          if (Object.keys($scope.ranges).length > 0 || $scope.maskingObjects[0].temporary_masking.length > 0) {
            var index = Object.keys($scope.ranges).length;
            for (var key in $scope.maskingObjects[0].temporary_masking) {
              if ($scope.maskingObjects[0].temporary_masking.hasOwnProperty(key)) {
                var range = $scope.maskingObjects[0].temporary_masking[key];
                var isRangeRepeated = Object.values($scope.ranges).some(function (obj) {
                  return obj.start === range.start && obj.end === range.end;
                });
                if (!isRangeRepeated) {
                  var isRangeRepeatedInNew = Object.values($scope.ranges).some(function (obj) {
                    return obj.start === range.start && obj.end === range.end;
                  });
                  if (!isRangeRepeatedInNew) {
                    $scope.ranges[index] = range;
                    index++;
                  }
                }
              }
            }
            $scope.mergedRanges = mergeRanges($scope.ranges);
            let maskingdata = {
              content_id: $scope.contentId,
              permanent_masking: $scope.maskingObjects[0].permanent_masking.length > 0 ? $scope.maskingObjects[0].permanent_masking : [],
              temporary_masking: $scope.mergedRanges
            };
            console.log(maskingdata, "temporary_maskingdata");
            $scope.args.tip.updateMasking($scope.maskingObjects[0].id, maskingdata);
            $uibModalInstance.close();
          }
        } else {
          if (Object.keys($scope.ranges).length > 0) {
            $scope.mergedRanges = mergeRanges($scope.ranges);
            let maskingdata = {
              content_id: $scope.contentId,
              permanent_masking: [],
              temporary_masking: $scope.mergedRanges
            };
            console.log(maskingdata, "temporary_maskingdata");
            $scope.args.tip.newMasking(maskingdata);
            $uibModalInstance.close();
          }
        }
      }
    }]);