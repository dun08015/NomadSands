function getUser() {

    $.ajax({
        url: "/getUser",
        method: "GET",
        success: (data) => {

            if (data.length === 0) {
                $('#userName').text("Menu");
            } else {
                $('#userName').text(data);
            }
        }
    });
}
