var entity = null;

function assetIsValid() {
    return entity.selectedAsset
        && entity.selectedAsset.type === "IMAGE"
        && (!entity.selectedAsset.fileSize || (entity.selectedAsset.fileSize && entity.selectedAsset.fileSize <= 1048576))
        && (!entity.selectedAsset.width || (entity.selectedAsset.width && entity.selectedAsset.width <= 1024));
}

function showDialog(){
    buildDialog(getDialogData());
    $('#confirmationModal').modal("show");
}

function getDialogData() {
    var dialogData = {};

    if (!entity.selectedAsset) {
        dialogData = {
            title: "Warning",
            bodyText: "Please select asset again. Thanks."
        };
    } else if (entity.selectedAsset.type !== "IMAGE") {
        dialogData = {
            title: "Warning",
            bodyText: "The asset type " + entity.selectedAsset.type + " is not supported for email, please copy the URL to add it as a link to image or text.",
            url: entity.selectedAsset.originalUrl
        };
        if (entity.selectedAsset.type === "VIDEO" && entity.selectedAsset.previewUrls) {
            dialogData.previewUrls = entity.selectedAsset.previewUrls;
        }
    } else if ((entity.selectedAsset.fileSize && entity.selectedAsset.fileSize > 1048576) 
        || (entity.selectedAsset.width && entity.selectedAsset.width > 1024)) {
        dialogData = {
            title: "Warning",
            bodyText: "The derivative selected exceeds recommended image width (1024px) or file size (1mb).",
            proceedBtn: true
        };
    } else {
        // Default dialog message
        dialogData = {
            title: "Warning",
            bodyText: "Please select asset again. Thanks."
        };
    }
    
    return dialogData;
}

function initDialog() {
    var modalDialog = $('#confirmationModal');
    modalDialog.find(".modal-title").text('');
    modalDialog.find(".modal-body p").text('');
    $("#copyUrl").hide();
    $("#prevUrls").empty();
    $("#addBtn").remove();
}

function buildDialog(dialogData) {
    $('#confirmationModal').on('show.bs.modal', function (event) {
        initDialog();
        var modalDialog = $(this);
        modalDialog.find(".modal-title").text(dialogData.title);
        modalDialog.find(".modal-body p").text(dialogData.bodyText);
        
        if (dialogData.url) {
            $("#copyUrl input").val(dialogData.url);
            $("#copyUrl").show();
        }

        if (dialogData.previewUrls) {
            // Clone #copyUrl div element and make a new one for each preview url inside #prevUrls div
            var $urlPaste = $("#copyUrl");
            dialogData.previewUrls.forEach(function (item, index) {
                var $klon = $urlPaste.clone().prop('id', 'prev'+index );
                if (index === 0) {
                    $("#prevUrls").html($klon);
                } else {
                    $("#prev" + (index-1)).after($klon);
                }
                $klon.find(".input-group-prepend span").text(item.split('.').pop()); // Get URL file extension
                $klon.find("input").val(item);
                $klon.find("button").attr("onclick","copyToClipboard('prev" + index + "')");
            });
        }

        if (dialogData.proceedBtn) {            
            $(".modal-footer").append("<button id='addBtn' type='button' class='btn' data-dismiss='modal'>Add asset</button>");
            var $addBtn = $("#addBtn");
            $addBtn.click(paintMap);
        }
    });
}

function copyToClipboard(id) {
    var copyText = $("#" + id).find("input");
    copyText.select();
    document.execCommand("copy");
}

function prepareEntity(selectedAsset, asset, data) {
    if (selectedAsset) {
        selectedAsset.initialUrl = selectedAsset.url;
        selectedAsset.type = asset.type;
        selectedAsset.name = (asset.name || "Image") + Date.now();
        selectedAsset.originalUrl = asset.originalUrl;
        selectedAsset.previewUrls = asset.previewUrls;
    }

    entity = {
        selectedAsset: selectedAsset,
        options: {
            style: data.options && data.options.style ? data.options.style : null,
            link: data.options && data.options.link ? data.options.link : null,
            cropBoxPosition: data.options && data.options.cropBoxPosition ? data.options.cropBoxPosition : null,
        }
    };
}

function paintMap() {
    return sdk.setData(entity, function () {
        window.location = "/contentEditor";
    });
}

var sdk = new window.sfdc.BlockSDK({
    blockEditorWidth: 850,
    tabs: ['stylingblock', 'htmlblock']
});

sdk.getData(function (data) {

    sdk.getContent(function (content) {

        if (content === '' || (data && data.options && data.options.isReplace)) {
            if (data && data.options && data.options.isReplace) {
                data.options.isReplace = false;
                sdk.setData(data);
            }

            BynderCompactView.open({
                language: "en_US",
                theme: {
                    colorButtonPrimary: "#3380FF"
                },
                mode: "SingleSelectFile",
                container: document.getElementById("bynder-compactview"),
                hideExternalAccess: true,
                onSuccess: function (assets, additionalInfo) {
                    var selectedAsset = additionalInfo.selectedFile;
                    var asset = assets[0];

                    try {
                        prepareEntity(selectedAsset, asset, data);
                    } finally {
                        if (assetIsValid()) {
                            paintMap();
                        } else {
                            showDialog();
                        }
                    }
                }
            });
        } else {
            try {
                entity = data;
            } finally {
                paintMap();
            }
        }

    });

});