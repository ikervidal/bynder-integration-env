"use strict";

var entity = null;
var initial = null;
var changes = []
var chgPos = 0;

var sdk;
var cropper;

function setAsset() {
    console.log('setAsset');
    sdk.setContent(buildAsset());
    sdk.setData(entity);
    updateEditor();
}

function saveChange() {
    // Save new change + check limit changes
    if (changes.length <= 10) {
        ++chgPos;
        changes = changes.slice(0, chgPos);
    } else {
        changes = changes.slice(1);
    }
    
    changes.push(_.cloneDeep(entity));
}

function updateEditor() {
    console.log('updateEditor');
    updateSaveCropButton();
    updateScaleToFit();
    updateLink();
    updateUndoRedoResetBtns();
    setCropBoxPosition();
    updateImageDims();
}

function buildAsset() {
    console.log('buildAsset');
    var asset = entity.selectedAsset;

    var height = entity.selectedAsset.height;
    var width = entity.selectedAsset.width;

    if (entity.options && entity.options.scaleToFit) {
        height = "auto";
        width = "100%";
    }

    var anchorStartTag = "";
    var anchorEndTag = "";
    if (entity.options.link) {
        var link = entity.options.link;
        var href, linkto;
        switch (link.type) {
            case "http":
            case "https":
                href = link.url;
                linkto = link.type + "://";
                break;
            case "email":
                href = "mailto:" + link.address + "?subject=" + link.subject;
                linkto = "mailto:";
                break;
        }

        anchorStartTag = "<a href='" + href + "' title='" + link.title + "' alias='" + link.alias
            + "' conversion='" + link.conversion + "' data-linkto='" + linkto + "'>";
        anchorEndTag = "</a>";
    }

    var cellStyle = "";
    if (entity.options.style) {
        if (entity.options.style.hAlign) cellStyle += "text-align:" + entity.options.style.hAlign + ";";
    }

    var importedAssetsContainer = "";
    switch (asset.type) {
        case "IMAGE":
            importedAssetsContainer +=
                "<table width='100%' cellspacing='0' cellpadding='0'><tr><td style='" + cellStyle + "'>"
                + anchorStartTag
                + "<img height='" + height + "' width='" + width + "' src=" + asset.url + " alt='We are processing the image'/>"
                + anchorEndTag
                + "</td></tr></table>";
            break;
        default:
            var options = {
                title: "Warning",
                bodyText: "The selected asset type is not supported!"
            };
            openConfirmationDialog(options);
            break;
    }
    return importedAssetsContainer;
}

function saveCroppingToSFMC(asset) {
    var body = {
        name: asset.name,
        assetType: {
            id: 28
        },
        file: asset.url
    };
    return axios.post('/saveCropping', body)
        .then(function (response) {
            return response.data;
        })
        .catch(function (error) {
            console.log(error);
        });
}

function updateSaveCropButton() {
    console.log('updateSaveCropButton');
    if (entity.selectedAsset) {
        $('#saveCroppingButton').prop("disabled", !entity.selectedAsset.isCropped);
    }
}

function saveCropBoxData(element) {
    console.log('saveCropBoxData');
    // Save the cropping box position
    var cropBoxData = cropper.getCropBoxData();
    console.log('inside save -- cropBoxData');
    console.log(cropBoxData);
    element.options.cropBoxPosition = {
        top: cropBoxData.top,
        left: cropBoxData.left,
        width: cropBoxData.width,
        height: cropBoxData.height
    };
}

function openConfirmationDialog(options) {
    $('#confirmationModal').on('show.bs.modal', function (event) {
        var modalDialog = $(this);
        modalDialog.find(".modal-title").text(options.title);
        modalDialog.find(".modal-body p").text(options.bodyText);
    });
    $('#confirmationModal').modal("show");
}

function updateScaleToFit() {
    // Updates editor view depending on scaleToFit value
    if (!entity.options.scaleToFit) {
        entity.options.scaleToFit = false;
    }
    $('#scaleToFit').prop("checked", entity.options.scaleToFit);
    $('#imageWidth').prop("disabled", entity.options.scaleToFit);
    $('#imageHeight').prop("disabled", entity.options.scaleToFit);
}

function setHAlign(align) {
    // Setter for the horizontal alignment
    if (!entity.options.style) {
        entity.options.style = {};
    }
    entity.options.style.hAlign = align;
    saveChange();
    setAsset();
}

function updateLink() {
    // Updates link view on editor after save or remove
    var labelHtml = '';
    if (entity.options.link) {
        var link = entity.options.link;
        switch (link.type) {
            case "http":
            case "https":
                labelHtml = link.url;
                break;
            case "email":
                labelHtml = link.address;
                break;
        }
        $("#addLinkBtn").hide();
        $("#editLinkBtn").show();
    } else {
        $("#addLinkBtn").show();
        $("#editLinkBtn").hide();
    }
    $("#remLinkBtn").prop("disabled", !entity.options.link);
}

function hideShowInputs() {
    // Hide/show inputs depending on link type
    var type = $("#linkToType option:selected").val();
    switch (type) {
        case "http":
        case "https":
            $("#linkUrl").show();
            $("#linkAddress").hide();
            $("#linkSubject").hide();
            break;
        case "email":
            $("#linkUrl").hide();
            $("#linkAddress").show();
            $("#linkSubject").show();
            break;
    }
}

function fillInputs() {
    // Updates link modal view
    if (entity.options.link) {
        var link = entity.options.link;
        $("#linkToType").val(link.type);
        $("#linkUrl input").val(link.url);
        $("#linkAddress input").val(link.address);
        $("#linkSubject input").val(link.subject);
        $("#linkTitle input").val(link.title);
        $("#linkAlias input").val(link.alias);
        $("#linkConversion input").prop("checked", link.conversion);
    } else {
        $("#linkAddress input").removeClass('is-invalid');
        $("#linkAddressHelp").hide();
        $("#linkForm").trigger("reset");
    }
    hideShowInputs();
    checkEnableSave();
}

function addHttpToUrl(url, type) {
    // Add http header depending on type selected
    if (url.substring(0, 8) !== "https://" && url.substring(0, 7) !== "http://") {
        url = type + "://" + url;
    }
    return url;
}

function checkFormValidity() {
    // All form validity checkers
    var type = $("#linkToType option:selected").val();
    checkHttpType(type);
    checkEmailValidity(type);
    checkEnableSave();
}

function checkHttpType(type) {
    // Update type select depending on if url has http or https
    if (type === "http" || type === "https") {
        var url = $("#linkUrl input").val();
        if (url.substring(0, 8) === "https://" && type === "http") {
            $("#linkToType").val("https");
        } else if (url.substring(0, 7) === "http://" && type === "https") {
            $("#linkToType").val("http");
        }
    }
}

function checkEmailValidity(type) {
    // Show/hide alerts depending on email validity
    if (type === "email") {
        if (!$("#linkAddress input").prop('validity').valid) {
            $("#linkAddress input").addClass('is-invalid');
            $("#linkAddressHelp").show();
        } else {
            $("#linkAddress input").removeClass('is-invalid');
            $("#linkAddressHelp").hide();
        }
    }
}

function checkEnableSave() {
    // Disable save button if not done editing link
    var type = $("#linkToType option:selected").val();
    var disabled = true;
    switch (type) {
        case "http":
        case "https":
            disabled = $("#linkUrl input").val() === '';
            break;
        case "email":
            disabled = $("#linkAddress input").val() === ''
                || $("#linkSubject input").val() === ''
                || !$("#linkAddress input").prop('validity').valid;
            break;
    }

    $("#linkSave").prop('disabled', disabled);
}

function deleteLink() {
    // Deletelink content and close modal
    entity.options.link = null;
    saveChange();
    setAsset();
}

function saveLink() {
    // Save link content and close modal
    var link = {};
    link.type = $("#linkToType option:selected").val();
    link.url = addHttpToUrl($("#linkUrl input").val(), link.type);
    link.address = $("#linkAddress input").val();
    link.subject = $("#linkSubject input").val();
    link.title = $("#linkTitle input").val();
    link.alias = $("#linkAlias input").val();
    link.conversion = $("#linkConversion input").is(":checked");

    entity.options.link = link;
    saveChange();
    setAsset();
}

function setCropBoxPosition() {
    console.log('setCropBoxPosition');
    if (entity.options.cropBoxPosition && cropper) {
        var cropBoxData = {
            top: entity.options.cropBoxPosition.top,
            left: entity.options.cropBoxPosition.left,
            width: entity.options.cropBoxPosition.width,
            height: entity.options.cropBoxPosition.height
        };
        cropper.setCropBoxData(cropBoxData);
    }
}

function resetEdit() {
    console.log('resetEdit');
    if (changes.length > 1) {
        chgPos = 0;
        entity = _.cloneDeep(initial);
        changes = [_.cloneDeep(initial)];
        setAsset();
    }
}

function undoEdit() {
    console.log('undoEdit');
    if (chgPos > 0) {
        --chgPos;
        entity = _.cloneDeep(changes[chgPos]);
        setAsset();
    }
}

function redoEdit() {
    if (chgPos < changes.length - 1) {
        ++chgPos;
        entity = _.cloneDeep(changes[chgPos]);
        setAsset();
    }
}

function updateUndoRedoResetBtns() {
    $("#undoBtn").prop("disabled", (chgPos <= 0));
    $("#redoBtn").prop("disabled", (chgPos >= changes.length - 1));
    $("#resetBtn").prop("disabled", (changes.length <= 1));
}

function updateImageDims() {
    console.log('entity.selectedAsset.height');
    console.log(entity.selectedAsset.height);
    console.log('entity.selectedAsset.width');
    console.log(entity.selectedAsset.width);
    $("#imageHeight").val(entity.selectedAsset.height);
    $("#imageWidth").val(entity.selectedAsset.width);
    
}

function onLoad() {
    console.log('onLoad');
    $('#spinner').show();
    $('#savingSpinner').hide();

    var Cropper = window.Cropper;
    var container = document.querySelector('.img-container');
    var image = container.getElementsByTagName('img').item(0);
    image.src = entity.selectedAsset.initialUrl;

    var croppingActions = document.getElementById('croppingActions');
    var imageActions = document.getElementById('imageActions');

    var imageHeight = document.getElementById('imageHeight');
    var imageWidth = document.getElementById('imageWidth');
    imageHeight.value = Math.round(Number(entity.selectedAsset.height));
    imageWidth.value = Math.round(Number(entity.selectedAsset.width));

    var btnLockImageProps = $('#lockImageProps');
    var imagePropsLocked = false;
    var imageAspectRatio = imageWidth.value / imageHeight.value;

    var dataHeight = document.getElementById('dataHeight');
    var dataWidth = document.getElementById('dataWidth');
    dataHeight.value = Math.round(entity.selectedAsset.height);
    dataWidth.value = Math.round(entity.selectedAsset.width);

    var btnLockDataProps = $('#lockDataProps');
    var dataPropsLocked = false;
    
    var options = {
        autoCropArea: 1,
        minContainerWidth: 800,
        minContainerHeight: 400,
        zoomOnWheel: false,
        restore: false,
        viewMode: 1,
        guides: false,
        center: false,
        crop: function (e) {
            console.log('e');
            console.log(e);
            var data = e.detail;
            console.log('init data height: ');
            console.log(Math.round(data.height));
            console.log('init data width: ');
            console.log(Math.round(data.width));
            dataHeight.value = Math.round(data.height);
            dataWidth.value = Math.round(data.width);
        },
        ready: function () {
            try {
                console.log('try');
                onLoaded();
            } finally {
                console.log('finally');
                saveCropBoxData(changes[0]);
                saveCropBoxData(initial);
            }
        },
        zoom: function (e) {
            var percentage = e.detail.ratio ? Math.round(e.detail.ratio * 100) : 100;
            $("#zoomValue").val(percentage + "%");
        }
    };

    cropper = new Cropper(image, options);

    // Buttons
    if (!document.createElement("canvas").getContext) {
        $("button[data-method='getCroppedCanvas']").prop("disabled", true);
    }

    btnLockImageProps.click(function () {
        // if unlock -> calculate new aspect ratio
        if (!imagePropsLocked) {
            imageAspectRatio = Number(imageWidth.value) / Number(imageHeight.value);
        }
        $('#imageLockIcon').toggleClass('fa-lock fa-unlock-alt');
        imagePropsLocked = !imagePropsLocked;
    });

    $('#imageHeight').on('change', function () {
        entity.selectedAsset.height = Number(imageHeight.value);
        if (imagePropsLocked) {
            // width = ar * height
            var calcWidth = Math.round(imageAspectRatio * Number(imageHeight.value));
            imageWidth.value = calcWidth;
            entity.selectedAsset.width = calcWidth;
        }
        saveChange();
        setAsset();
    });

    $('#imageWidth').on('change', function () {
        entity.selectedAsset.width = Number(imageWidth.value);
        if (imagePropsLocked) {
            // height = width / ar
            var calcHeight = Math.round(Number(imageWidth.value) / imageAspectRatio);
            imageHeight.value = calcHeight;
            entity.selectedAsset.height = calcHeight;
        }
        saveChange();
        setAsset();
    });

    $('#scaleToFit').on('change', function () {
        entity.options.scaleToFit = !entity.options.scaleToFit;
        saveChange();
        setAsset();
    });

    btnLockDataProps.click(function () {
        try {
            saveCropBoxData(entity);
        } finally {
            if (dataPropsLocked) {
                cropper.setAspectRatio("NaN");
            } else {
                cropper.setAspectRatio(Number(dataWidth.value) / Number(dataHeight.value));
            }
        }
        setCropBoxPosition();
        $('#dataLockIcon').toggleClass('fa-lock fa-unlock-alt');
        dataPropsLocked = !dataPropsLocked;
    });

    $('#dataHeight').on('change', function () {
        console.log('data Height change');
        var cropData = cropper.getCropBoxData();
        console.log('cropData');
        console.log(cropData);
        console.log('dataHeight');
        console.log(dataHeight.value);
        console.log('dataWidth');
        console.log(dataWidth.value);
        cropData.height = dataHeight.value !== '' ? parseFloat(dataHeight.value) : 0;
        cropData.width = dataWidth.value !== '' ? parseFloat(dataWidth.value) : 0;
        //var ratio = document.getElementById('imageToCrop').cropper.imageData.width /  document.getElementById('imageToCrop').cropper.imageData.naturalWidth; 

        console.log('2 - cropData');
        console.log(cropData);
        cropper.setCropBoxData(cropData);
        saveCropBoxData();
    });

    $('#dataWidth').on('change', function () {
        console.log('data Width change');
        var cropData = cropper.getCropBoxData();
        console.log('cropData');
        console.log(cropData);
        console.log('dataHeight');
        console.log(dataHeight.value);
        console.log('dataWidth');
        console.log(dataWidth.value);
        cropData.height = dataHeight.value !== '' ? Number(dataHeight.value) : 0;
        cropData.width = dataWidth.value !== '' ? Number(dataWidth.value) : 0;

        console.log('2 - cropData');
        console.log(cropData);
        cropper.setCropBoxData(cropData);
    });

    // Methods
    imageActions.querySelector(".image-buttons").onclick = function (event) {
        var e = event || window.event;
        var target = e.target || e.srcElement;

        while (target !== this) {
            if (target.getAttribute("data-method")) {
                break;
            }

            target = target.parentNode;
        }

        if (target === this || target.disabled || target.className.indexOf("disabled") > -1) {
            return;
        }
        var method = target.getAttribute("data-method");

        if (method) {
            switch (method) {

                case "customReplace":
                    entity.options.isReplace = true;
                    sdk.setData(entity, function () {
                        return window.location = "/compactView";
                    });
                    break;

                case "customDelete":
                    sdk.setContent("", function () {
                        sdk.setData("", function () {
                            return window.location = "/compactView";
                        });
                    });
                    break;

                case "alignLeft":
                    setHAlign("left");
                    break;

                case "alignCenter":
                    setHAlign("center");
                    break;

                case "alignRight":
                    setHAlign("right");
                    break;

            }
        }
    };

    croppingActions.querySelector(".cropping-buttons").onclick = function (event) {
        var e = event || window.event;
        var target = e.target || e.srcElement;
        var result;
        var cropped;
        var input;
        var data;

        if (!cropper) {
            return;
        }

        while (target !== this) {
            if (target.getAttribute("data-method")) {
                break;
            }

            target = target.parentNode;
        }

        if (target === this || target.disabled || target.className.indexOf("disabled") > -1) {
            return;
        }

        data = {
            method: target.getAttribute("data-method"),
            target: target.getAttribute("data-target"),
            option: target.getAttribute("data-option") || undefined,
            secondOption: target.getAttribute("data-second-option") || undefined
        };

        cropped = cropper.cropped;

        if (data.method) {
            if (typeof data.target !== "undefined") {
                input = document.querySelector(data.target);

                if (!target.hasAttribute("data-option") && data.target && input) {
                    try {
                        data.option = JSON.parse(input.value);
                    } catch (e) {
                        console.log(e.message);
                    }
                }
            }

            switch (data.method) {
                case "getCroppedCanvas":
                    try {
                        data.option = JSON.parse(data.option);
                    } catch (e) {
                        console.log(e.message);
                    }
                    break;
            }

            if (data.method != "saveCropping" && data.method != "lockDataProps"
                && data.method != "undoEdit" && data.method != "redoEdit" && data.method != "resetEdit") {
                result = cropper[data.method](data.option, data.secondOption);
            }

            switch (data.method) {
                case "resetEdit":
                    resetEdit();
                    break;
                case "undoEdit":
                    undoEdit();
                    break;
                case "redoEdit":
                    redoEdit();
                    break;
                case "getCroppedCanvas":
                    if (result) {
                        entity.selectedAsset.url = result.toDataURL();
                        entity.selectedAsset.isCropped = true;
                        entity.selectedAsset.height = result.height;
                        entity.selectedAsset.width = result.width;

                        if (imagePropsLocked) {
                            imageAspectRatio = Number(imageWidth.value) / Number(imageHeight.value);
                        }

                        saveCropBoxData(entity);
                        saveChange();
                        setAsset();
                    }
                    break;

                case "saveCropping":
                    if (entity.selectedAsset && entity.selectedAsset.isCropped) {
                        $('#savingSpinner').show();
                        $('#spinner').show();
                        entity.selectedAsset.url = entity.selectedAsset.url.substring(22);
                        saveCroppingToSFMC(entity.selectedAsset).then(function (response) {
                            entity.selectedAsset.url = response.fileProperties.publishedURL;
                            delete entity.selectedAsset.isCropped;
                            setAsset();
                            $('#savingSpinner').hide();
                            $('#spinner').hide();
                        });
                    }
                    break;
            }

            if (typeof result === "object" && result !== cropper && input) {
                try {
                    input.value = JSON.stringify(result);
                } catch (e) {
                    console.log(e.message);
                }
            }
        }
    };

    $("#addLinkBtn").click(function () {
        fillInputs();
        $("#linkModal").modal("show");
    });

    $("#editLinkBtn").click(function () {
        fillInputs();
        $("#linkModal").modal("show");
    });

    $("#remLinkBtn").click(function () {
        deleteLink();
    });

    $("#linkToType").on("change", function () {
        hideShowInputs();
        checkFormValidity();
    });

    $("#linkModal input").on("input", function () {
        checkFormValidity();
    });

    $("#linkSave").click(function () {
        saveLink();
        $("#linkModal").modal("hide");
    });

}

function onLoaded() {
    console.log('onLoaded');
    $('#spinner').hide();
    updateEditor();
}

function onInit() {
    console.log('onInit');
    sdk = new window.sfdc.BlockSDK({
        blockEditorWidth: 850,
        tabs: ['stylingblock', 'htmlblock']
    });

    sdk.getData(function (data) {
        entity = _.cloneDeep(data);
        initial = _.cloneDeep(data);
        changes = [_.cloneDeep(data)];
        chgPos = 0;
        setAsset();
        onLoad();
    });
}

onInit();
