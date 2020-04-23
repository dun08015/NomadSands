//display default match time as time when create match main menu button was clicked
$("#mainMenuCreateMatch").click(function (event) {
    // "13:45:00"
    // "2011-08-19"
    var currentDateTime = new Date();

    var month = currentDateTime.getMonth() + 1;
    var monthString = "";

    if (month < 10) {
        monthString = "0" + month;
    } else {
        monthString += month;
    }

    var day = currentDateTime.getDate();
    var dayString = "";

    if (day < 10) {
        dayString = "0" + day;
    } else {
        dayString += day;
    }

    var formattedDate = currentDateTime.getFullYear() + "-" + monthString + "-" + dayString;

    var formattedTime = currentDateTime.getHours() + ":" + currentDateTime.getMinutes() + ":00";

    console.log(formattedDate);
    console.log(formattedTime);

    $("#matchDate").val(formattedDate);
    $("#matchTime").val(formattedTime);

});