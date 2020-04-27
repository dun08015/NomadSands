$("#createMatch").click(function (event) {

    if ($('#dropdownMenu').text() === "Choose Discord Server") {

        $("#selectDiscordServerAlert").collapse('show');

    } else {

        $("#myForm").modal('hide');

        requestMatchInsert();

    }

});

$("#mainMenuCreateMatch").click(function (event) {

    formatDateTime();

    getUserOwnedGuilds();

});

//this part below took a few hours to figure out
//should be $(parent element).on(click, dynamically generated child element, event params, function call)

$("#userDiscordServers").on("click", ".dropdown-item", $(this).event, updateRedirect);

function updateRedirect(event) {

    if (event.target.id.includes("userGuildSelect")) {

        $("#dropdownMenu").html(event.target.innerText);

        $("#selectDiscordServerAlert").collapse('hide');

    }

}
