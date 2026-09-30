const regEmail = /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/

/*document.querySelector(`#btnOrder`).addEventListener(`click`,function(){
    let strOption = document.querySelector(`#txtOption`).value
    let strType = document.querySelector(`#txtType`).value
    let strAddress = document.querySelector(`#txtAddress`).value
    let strZip = document.querySelector(`#txtZip`).value
    let strCity = document.querySelector(`#txtCity`).value
    let strAmount = document.querySelector(`#txtAmount`).value
    let strEmail = document.querySelector(`#txtEmail`).value
    let strPassword = document.querySelector(`#txtPassword`).value

    let blnError = false
    let strError = ``

    if(!regEmail.test(strEmail)){
       blnError = true
       strError += '<p>You must enter a valid email<p>'
}
if(strPassword.trim().length < 1){
    blnError = true
    strError += '<p>You must enter a password'
}

    if (blnError == true){
        Swal.fire({
        icon: "error",
        title: "Oh no!",
        html: strError,
        showConfirmButton: true,        
        });
    } else {
        Swal.fire({
        position: "top-end",
        icon: "success",
        title: "Good Job!",
        showConfirmButton: true,
        timer: 3000  
    });
}
})
*/

document.querySelector('#btnOrder').addEventListener('click', function () {
  let strEmail = document.querySelector('#txtEmail').value
  let strPassword = document.querySelector('#txtPassword').value

  let blnError = false
  let strError = ''

  if (!regEmail.test(strEmail)) {
    blnError = true
    strError += '<p>You must enter a valid email</p>'
  }

  if (strPassword.trim().length < 1) {
    blnError = true
    strError += '<p>You must enter a password</p>'
  }

  if (blnError) {
    Swal.fire({
      icon: 'error',
      title: 'Oh no!',
      html: strError
    })
  } else {
    Swal.fire({
      icon: 'success',
      title: 'Good job!',
      timer: 3000
    })
  }
})
