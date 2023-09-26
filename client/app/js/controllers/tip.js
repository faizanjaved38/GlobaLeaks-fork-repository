GL.controller("TipCtrl",
  ["$scope", "$location", "$filter", "$http", "$interval", "$routeParams", "$uibModal", "Authentication", "RTip", "WBTip", "RTipExport", "RTipDownloadRFile", "RTipFileSourceGet", "WBTipFileSourceGet", "WBTipDownloadFile", "fieldUtilities", "RTipViewRFile", "RTipWBFileResource",
    function($scope, $location, $filter, $http, $interval, $routeParams, $uibModal, Authentication, RTip, WBTip, RTipExport, RTipDownloadRFile, RTipFileSourceGet, WBTipFileSourceGet, WBTipDownloadFile, fieldUtilities, RTipViewRFile, RTipWBFileResource) {
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
      $scope.openGrantTipAccessModal = function() {
        $http({
          method: "PUT",
          url: "api/user/operations",
          data: {
            "operation": "get_users_names",
            "args": {}
          }
        }).then(function(response) {
          $uibModal.open({
            templateUrl: "views/modals/grant_access.html",
            controller: "ConfirmableModalCtrl",
            resolve: {
              arg: {
                users_names: response.data
              },
              confirmFun: function() {
                return function(receiver_id) {
                  var req = {
                    operation: "grant",
                    args: {
                      receiver: receiver_id
                    },
                  };
                  return $http({
                    method: "PUT",
                    url: "api/rtips/" + $scope.tip.id,
                    data: req
                  }).then(function() {
                    $scope.reload();
                  });
                };
              },
              cancelFun: null
            }
          });
        });
      };

      $scope.openRevokeTipAccessModal = function() {
        $http({
          method: "PUT",
          url: "api/user/operations",
          data: {
            "operation": "get_users_names",
            "args": {}
          }
        }).then(function(response) {
          $uibModal.open({
            templateUrl: "views/modals/revoke_access.html",
            controller: "ConfirmableModalCtrl",
            resolve: {
              arg: {
                users_names: response.data
              },
              confirmFun: function() {
                return function(receiver_id) {
                  var req = {
                    operation: "revoke",
                    args: {
                      receiver: receiver_id
                    }
                  };

                  return $http({
                    method: "PUT",
                    url: "api/rtips/" + $scope.tip.id,
                    data: req
                  }).then(function() {
                    $scope.reload();
                  });
                };
              },
              cancelFun: null
            }
          });
        });
      };

      $scope.getAnswersEntries = function(entry) {
        if (typeof entry === "undefined") {
          return $scope.answers[$scope.field.id];
        }

        return entry[$scope.field.id];
      };



      var filterNotTriggeredField = function(parent, field, answers) {
        var i;
        if (fieldUtilities.isFieldTriggered(parent, field, answers, $scope.tip.score)) {
          for (i = 0; i < field.children.length; i++) {
            filterNotTriggeredField(field, field.children[i], answers);
          }
        }
      };

      $scope.preprocessTipAnswers = function(tip) {
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

      $scope.hasMultipleEntries = function(field_answer) {
        return (typeof field_answer !== "undefined") && field_answer.length > 1;
      };

      $scope.filterFields = function(field) {
        return field.type !== "fileupload";
      };

      if ($scope.Authentication.session.role === "whistleblower") {
        $scope.fileupload_url = "api/wbtip/rfile";

        $scope.tip = new WBTip(function(tip) {
          $scope.tip = tip;
          $scope.tip.context = $scope.contexts_by_id[$scope.tip.context_id];
          $scope.tip.receivers_by_id = $scope.Utils.array_to_map($scope.tip.receivers);
          $scope.score = $scope.tip.score;

          $scope.loadRFile = WBTipFileSourceGet;
          $scope.fetchAudioFiles()

          $scope.ctx = "wbtip";
          $scope.preprocessTipAnswers(tip);

          $scope.tip.submissionStatusStr = $scope.Utils.getSubmissionStatusText($scope.tip.status, $scope.tip.substatus, $scope.submission_statuses);

          $scope.downloadWBFile = function(file) {
            WBTipDownloadFile(file);
          };

          // FIXME: remove this variable that is now needed only to map wb_identity_field
          $scope.submission = {};
          $scope.submission._submission = tip;

          $scope.provideIdentityInformation = function(identity_field_id, identity_field_answers) {
            for (var key in $scope.uploads) {
              if ($scope.uploads[key]) {
                $scope.uploads[key].resume();
              }
            }

            $scope.interval = $interval(function() {
              for (var key in $scope.uploads) {
                if ($scope.uploads[key] &&
                  $scope.uploads[key].isUploading() &&
                  $scope.uploads[key].isUploading()) {
                  return;
                }
              }

              $interval.cancel($scope.interval);

              return $http.post("api/wbtip/" + $scope.tip.id + "/provideidentityinformation", {
                "identity_field_id": identity_field_id,
                "identity_field_answers": identity_field_answers
              }).
              then(function() {
                $scope.reload();
              });

            }, 1000);
          };

          if (tip.receivers.length === 1 && tip.msg_receiver_selected === null) {
            tip.msg_receiver_selected = tip.msg_receivers_selector[0].key;
          }
        });

      } else if ($scope.Authentication.session.role === "receiver") {
        $scope.tip = new RTip({
          id: $scope.tip_id
        }, function(tip) {
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
          $scope.show = function(id) {
            return !!$scope.tip.masking.find(mask => mask.content_id === id);
          }
          var reloadUI = function() {
            $scope.reload();
          };
          $scope.deleteWBFile = function(f) {
            let maskingObjects = $scope.tip.masking.filter(function(masking) {
              return masking.content_id === f.id;
            });
            if (maskingObjects.length !== 0) {
              return $http({
                method: "DELETE",
                url: "api/rtips/" + tip.id + "/delete/maskingfile/" + maskingObjects[0].id
              }).then(reloadUI);
            }
          };
          $scope.unmaskFile = function(f) {
            let maskingObjects = $scope.tip.masking.filter(function(masking) {
              return masking.content_id === f.id;
            });
            if (maskingObjects.length !== 0) {
              return $http({
                method: "DELETE",
                url: "api/rtips/" + tip.id + "/masking/" + maskingObjects[0].id
              }).then(reloadUI);
            }
          };
          $scope.masking = function(id) {
            $scope.status = true
            var maskingdata = {
              content_id: id,
              permanent_masking: [],
              temporary_masking: {
                fileMaskingStatus: $scope.status
              }
            }
            $scope.tip.newMasking(maskingdata);
          }
          $scope.showEditLabelInput = $scope.tip.label === "";
          $scope.tip.submissionStatusStr = $scope.Utils.getSubmissionStatusText($scope.tip.status, $scope.tip.substatus, $scope.submission_statuses);
          $scope.supportedViewTypes = ["application/pdf", "audio/mpeg", "image/gif", "image/jpeg", "image/png", "text/csv", "text/plain", "video/mp4"];

        });
      }

      $scope.editLabel = function() {
        $scope.showEditLabelInput = true;
      };

      $scope.markReportStatus = function(date) {
        var report_date = new Date(date);
        var current_date = new Date();
        return current_date > report_date;
      };
      $scope.permanentMaskingObjects = []
      $scope.maskingObjects = []

      // function permanentRefineContent(content, permanentMaskingObjects) {
      //   var refinedContent = content;
      //   permanentMaskingObjects.forEach(function(obj) {
      //     var start = obj.start;
      //     var end = obj.end;
      //     var stars = String.fromCharCode(0x2588).repeat(end - start + 1);
      //     var insertPosition = start;
      //     refinedContent = refinedContent.substring(0, insertPosition) + stars + refinedContent.substring(insertPosition);
      //   });
      //   return refinedContent;
      // }
      function permanentRefineContent(content, ranges) {
        var maskedText = content.split('');
  
        ranges.forEach(function (range) {
          if (range.start >= 0 && range.start <= maskedText.length && range.end >= 0) {
            for (var i = range.start; i <= range.end; i++) {
              maskedText.splice(i, 0, String.fromCharCode(0x2588));
            }
          }
        });
  
        return maskedText.join('');
      }
      $scope.edited = function(id) {
        $scope.maskingObjects = $scope.tip.masking.filter(function(masking) {
          return masking.content_id === id;
        });
        if ($scope.maskingObjects.length !== 0 && $scope.maskingObjects[0].permanent_masking.length > 0) {
          return true
        } else {
          return false
        }
      }
      $scope.maskingContent = function(content, id) {
        $scope.permanentMaskingObjects = $scope.tip.masking.filter(function(masking) {
          return masking.content_id === id;
        });
        if ($scope.permanentMaskingObjects.length !== 0 && $scope.permanentMaskingObjects[0].permanent_masking.length > 0) {
          var permanentMaskingArray = Object.values($scope.permanentMaskingObjects[0].permanent_masking);
          permanentMaskingArray.sort(function(a, b) {
            return a.start - b.start;
          });
          var contentData = permanentRefineContent(content, permanentMaskingArray);
          return contentData
        } else {
          return content
        }
      }
      $scope.updateLabel = function(label) {
        $scope.tip.operation("set", {
          "key": "label",
          "value": label
        }).then(function() {
          $scope.showEditLabelInput = false;
        });
      };

      $scope.updateSubmissionStatus = function() {
        $scope.tip.updateSubmissionStatus().then(function() {
          $scope.tip.submissionStatusStr = $scope.Utils.getSubmissionStatusText($scope.tip.status, $scope.tip.substatus, $scope.submission_statuses);
        });
      };

      $scope.fetchAudioFiles = function() {
        for (let dictionary of $scope.tip.rfiles) {
          $scope.audiolist[dictionary['reference']] = {}
          $scope.audiolist[dictionary['reference']]['key'] = dictionary;
          $scope.audiolist[dictionary['reference']]['value'] = null;
        }
      };

      $scope.newComment = function() {
        $scope.tip.newComment($scope.tip.newCommentContent);
        $scope.tip.newCommentContent = "";
      };

      $scope.newMessage = function() {
        $scope.tip.newMessage($scope.tip.newMessageContent);
        $scope.tip.newMessageContent = "";
      };

      $scope.tip_toggle_star = function() {
        return $scope.tip.operation("set", {
          "key": "important",
          "value": !$scope.tip.important
        }).then(function() {
          $scope.tip.important = !$scope.tip.important;
        });
      };

      $scope.tip_notify = function(enable) {
        return $scope.tip.operation("set", {
          "key": "enable_notifications",
          "value": enable
        }).then(function() {
          $scope.tip.enable_notifications = enable;
        });
      };

      $scope.tip_delete = function() {
        $uibModal.open({
          templateUrl: "views/modals/delete_confirmation.html",
          controller: "TipOperationsCtrl",
          resolve: {
            args: function() {
              return {
                tip: $scope.tip,
                operation: "delete"
              };
            }
          }
        });
      };

      $scope.tip_postpone = function() {
        $uibModal.open({
          templateUrl: "views/modals/tip_operation_postpone.html",
          controller: "TipOperationsCtrl",
          resolve: {
            args: function() {
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

      $scope.set_reminder = function() {
        $uibModal.open({
          templateUrl: "views/modals/tip_operation_set_reminder.html",
          controller: "TipOperationsCtrl",
          resolve: {
            args: function() {
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
      $scope.editReport = function(content, id, type) {
        $uibModal.open({
          templateUrl: "views/modals/report_reduct.html",
          controller: "TipEditReportCtrl",
          resolve: {
            args: function() {
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
                data: {
                  content,
                  id,
                  type
                }
              };
            }
          }
        });
      };
      $scope.tip_mode = function(value) {
        $scope.mode = value;
      }
      $scope.tip_open_additional_questionnaire = function() {
        $scope.answers = {};
        $scope.uploads = {};
        $uibModal.open({
          templateUrl: "views/modals/tip_additional_questionnaire_form.html",
          controller: "AdditionalQuestionnaireCtrl",
          scope: $scope
        });
      };
      $scope.access_identity = function() {
        return $http.post("api/rtips/" + $scope.tip.id + "/iars", {
          "request_motivation": ""
        }).then(function() {
          $scope.reload();
        });
      };
      $scope.file_identity_access_request = function() {
        $uibModal.open({
          templateUrl: "views/modals/tip_operation_file_identity_access_request.html",
          controller: "IdentityAccessRequestCtrl",
          resolve: {
            tip: function() {
              return $scope.tip;
            }
          }
        });
      };

      $scope.score = 0;

      $scope.$watch("answers", function() {
        fieldUtilities.onAnswersUpdate($scope);
      }, true);

      $scope.$on("GL::uploadsUpdated", function() {
        fieldUtilities.onAnswersUpdate($scope);
      });



    }
  ]).
controller("TipOperationsCtrl",
  ["$scope", "$http", "$location", "$uibModalInstance", "args",
    function($scope, $http, $location, $uibModalInstance, args) {
      $scope.args = args;

      $scope.cancel = function() {
        $uibModalInstance.close();
      };

      $scope.disable_reminder = function() {
        $uibModalInstance.close();
        var req = {
          "operation": "set_reminder",
          "args": {
            "value": 32503680000000
          }
        };

        return $http({
          method: "PUT",
          url: "api/rtips/" + args.tip.id,
          data: req
        }).then(function() {
          $scope.reload();
        });
      };

      $scope.confirm = function() {
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

          return $http({
            method: "PUT",
            url: "api/rtips/" + args.tip.id,
            data: req
          }).then(function() {
            $scope.reload();
          });
        } else if (args.operation === "delete") {
          return $http({
            method: "DELETE",
            url: "api/rtips/" + args.tip.id,
            data: {}
          }).
          then(function() {
            $location.url("/recipient/reports");
            $scope.reload();
          });
        }
      };
    }
  ]).
controller("RTipWBFileUploadCtrl", ["$scope", "Authentication", "RTipDownloadWBFile", "RTipWBFileResource", function($scope, Authentication, RTipDownloadWBFile, RTipWBFileResource) {
  var reloadUI = function() {
    $scope.reload();
  };

  $scope.downloadWBFile = function(f) {
    RTipDownloadWBFile(f);
  };

  $scope.deleteWBFile = function(f) {
    RTipWBFileResource.remove({
      "id": f.id
    }).$promise.finally(reloadUI);
  };
}]).
controller("WBTipFileDownloadCtrl", ["$scope", "$uibModalInstance", "WBTipDownloadFile", "file", "tip", function($scope, $uibModalInstance, WBTipDownloadFile, file, tip) {
  $scope.ctx = "download";
  $scope.file = file;
  $scope.tip = tip;
  $scope.confirm = function() {
    $uibModalInstance.close();
    WBTipDownloadFile(file);
  };

  $scope.cancel = function() {
    $uibModalInstance.close();
  };
}]).
controller("IdentityAccessRequestCtrl",
  ["$scope", "$http", "$uibModalInstance", "tip",
    function($scope, $http, $uibModalInstance, tip) {
      $scope.tip = tip;

      $scope.cancel = function() {
        $uibModalInstance.close();
      };

      $scope.confirm = function() {
        $uibModalInstance.close();

        return $http.post("api/rtips/" + tip.id + "/iars", {
          "request_motivation": $scope.request_motivation
        }).
        then(function() {
          $scope.reload();
        });
      };
    }
  ]).
controller("WhistleblowerFilesCtrl", ["$scope", function($scope) {
  $scope.uploads = {};
}]).
controller("WhistleblowerIdentityFormCtrl", ["$scope", function($scope) {
  $scope.uploads = {};
}]).controller("TipEditReportCtrl", ["$scope", "masking", "$sce", "$uibModalInstance", "args", "Authentication", "$routeParams", "$http", function($scope, masking, $sce, $uibModalInstance, args, Authentication, $routeParams, $http) {

  $scope.args = args;
  $scope.forced_visible = false
  $scope.maskingSwitch = $scope.resources.preferences.can_privilege_mask_information ? true : false;
  $scope.temporaryMaskingSwitch = $scope.resources.preferences.can_privilege_mask_information

  $scope.cancel = function() {
    $uibModalInstance.close();
  };

  $scope.toggleForcedView = function() {
    $scope.forced_visible = !$scope.forced_visible
    window.getSelection().removeAllRanges();
  }

  $scope.toggleTempMaskingSwitch = function() {
    $scope.temporaryMaskingSwitch = !$scope.temporaryMaskingSwitch
  }

  $scope.initializeMasking = function() {

    $scope.maskingObjects = $scope.args.tip.masking.filter(function(masking) {
      return masking.content_id === $scope.args.data.id;
    })[0];

    $scope.permanent_ranges_selected = []
    $scope.temporary_ranges_unselected = []

    if ($scope.maskingObjects) {
      $scope.temporary_masking = $scope.maskingObjects.temporary_masking
      $scope.permanent_masking = $scope.maskingObjects.permanent_masking
    } else {
      $scope.temporary_masking = []
      $scope.permanent_masking = []
    }

    $scope.temporary_ranges_selected = $scope.temporary_masking
    $scope.content = masking.maskPermanentContent($scope.args.data.content, $scope.permanent_masking);
    $scope.content = masking.maskContent($scope.content, $scope.temporary_masking);
  };

  $scope.selectContent = function() {
    if ($scope.maskingSwitch) {
      if($scope.temporaryMaskingSwitch){
        $scope.temporary_ranges_selected = masking.getSelectedRanges(true, $scope.temporary_ranges_selected, $scope.args.data.content)
        $scope.temporary_ranges_selected = masking.removeAndSplitRanges($scope.permanent_masking, $scope.temporary_ranges_selected)
        $scope.temporary_ranges_unselected = masking.getSelectedRanges(false, $scope.temporary_ranges_unselected, $scope.args.data.content)
        masking.onHighlight('#007bff', 'white')
        //alert(JSON.stringify($scope.temporary_ranges_selected))
      }else{
        $scope.temporary_ranges_unselected = masking.getSelectedRanges(true, $scope.temporary_ranges_unselected, $scope.args.data.content)
        $scope.temporary_ranges_selected = masking.getSelectedRanges(false, $scope.temporary_ranges_selected, $scope.args.data.content)
        masking.onHighlight('#FF0000', 'white')
      }
    } else {
      $scope.permanent_ranges_selected = masking.getSelectedRanges(true, $scope.permanent_ranges_selected, $scope.args.data.content)
      masking.onHighlight('#007bff', 'white')
    }
  };

  $scope.erase = function() {
    if ($scope.maskingSwitch) {
      $scope.temporary_ranges_selected = masking.getSelectedRanges(false, $scope.temporary_ranges_selected, $scope.args.data.content)
      $scope.temporary_ranges_unselected = masking.getSelectedRanges(false, $scope.temporary_ranges_unselected, $scope.args.data.content)
    } else {
      $scope.permanent_ranges_selected = masking.getSelectedRanges(false, $scope.permanent_ranges_selected, $scope.args.data.content)
    }
    masking.onHighlight('white', 'black')
  };

  $scope.saveMasking = function() {
    let maskingData = {
      content_id: $scope.args.data.id,
      permanent_masking: [],
      temporary_masking: []
    };

    if($scope.maskingSwitch){
      maskingData['temporary_masking'] = $scope.temporary_ranges_selected
    }else{
      maskingData['content_type'] = $scope.args.data.type
      maskingData['permanent_masking'] = masking.intersectRanges($scope.temporary_masking, $scope.permanent_ranges_selected)
    }

    if($scope.maskingObjects){
      //alert(JSON.stringify(maskingData))
      $scope.args.tip.updateMasking($scope.maskingObjects.id, maskingData);
    }else{
      //alert(JSON.stringify(maskingData))
      $scope.args.tip.newMasking(maskingData);
    }
    $scope.cancel()
  }

  $scope.getContent = function() {
    if ($scope.forced_visible) {
      return masking.maskPermanentContent($scope.args.data.content, $scope.permanent_masking);
    } else {
      return $scope.content;
    }
  }

  $scope.toggleMasking = function(maskingSwitch) {
    $scope.initializeMasking()
    const container = document.getElementById('redact');
    const range = document.createRange();
    range.selectNodeContents(container);
    window.getSelection().addRange(range);
    masking.onHighlight('white', 'black')
  };

  $scope.initializeMasking()

}]);