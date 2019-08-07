App = {
  web3Provider: null,
  contracts: {},

  init: async function() {
    return await App.initWeb3();
  },

  initWeb3: async function() {
      // Modern dapp browsers...
  if (window.ethereum) {
    App.web3Provider = window.ethereum;
    try {
      // Request account access
      await window.ethereum.enable();
    } catch (error) {
      // User denied account access...
      console.error("User denied account access")
    }
  }
  // Legacy dapp browsers...
  else if (window.web3) {
    App.web3Provider = window.web3.currentProvider;
  }
  // If no injected web3 instance is detected, fall back to Ganache
  else {
    App.web3Provider = new Web3.providers.HttpProvider('https://ropsten.infura.io/v3/e1fc7a67bed2467c93a6b19a65c49326');
  }

  web3 = new Web3(App.web3Provider);
  return App.initContract();
  },

  initContract: function() {
      $.getJSON('Janken.json', function(data) {
    // Get the necessary contract artifact file and instantiate it with truffle-contract
    var JankenArtifact = data;
    App.contracts.Janken = TruffleContract(JankenArtifact);

    // Set the provider for our contract
    App.contracts.Janken.setProvider(App.web3Provider);
    App.eventWatch();
  });
    App.joinGame();
    App.setHandPlayer1();
    App.setHandPlayer2();
    App.judge();
    App.getBackBet();
    App.createGame();
  },

  createGame: function(){
      $(document).on('click', '#createButton', async function(event){
          event.preventDefault();
          let ether = $("#player1bet").val();
          ether = web3.toWei(ether, 'ether');
          const instance = await App.contracts.Janken.deployed();
          instance.createGame({value: ether});
      });

  },

  joinGame: function(){
      $(document).on('click', '#joinButton', async function(event){
          event.preventDefault();
          const gameId = $("#gameId").val()
          const instance = await App.contracts.Janken.deployed();
          let ether = await instance.getBet(gameId);
          // console.log(ether);
          instance.joinGame(gameId, {value: ether});
      });
  },

  getBackBet: function(){
      $(document).on('click', '#getBackBet', async function(event){
          event.preventDefault();
          const gameId = $("#gameIdForGetBackBet").val();
          const instance = await App.contracts.Janken.deployed();
          const hostPlayer = await instance.getPlayer1(gameId);
          const guestPlayer = await instance.getPlayer2(gameId);
          web3.eth.getAccounts(async (err, accounts) => {
              const account = accounts[0];
              if(account == hostPlayer){
                  instance.getBackBetForPlayer1(gameId);
              }else if(account == guestPlayer){
                  instance.getBackBetForPlayer2(gameId);
              }
          });


      });
  },

 setHandPlayer1: function(){
     $(document).on('click', '#player1HandSubmit', async function(event){
         event.preventDefault();
         const gameId = $("#gameIdForModal").val();
         const player1hand = $("#player1hand").val();
         const passPhrase = $("#passPhrase").val();
         const instance = await App.contracts.Janken.deployed();

         let hostPlayerHand = await instance.getPlayer1hand(gameId);
         hostPlayerHand = parseInt(hostPlayerHand, 16);
         if(!hostPlayerHand){
             instance.setHandPlayer1(gameId, player1hand, passPhrase);
         }


     });
 },

 setHandPlayer2: function(){
     $(document).on('click', '#player2handSubmit', async function(event){
         event.preventDefault();
         const gameId = $("#gameIdForModal").val();
         const player2hand = $("#player2hand").val();
         const instance = await App.contracts.Janken.deployed();

         let hostPlayerHand = await instance.getPlayer1hand(gameId);
         hostPlayerHand = parseInt(hostPlayerHand, 16);
         let guestPlayerHand = await instance.getPlayer2hand(gameId);
         guestPlayerHand = parseInt(guestPlayerHand.toString());

         if(hostPlayerHand && !guestPlayerHand){
             instance.setHandPlayer2(gameId, player2hand);
         }
     });
 },

 judge: function(){
     $(document).on('click', '#judge', async function(event){
         event.preventDefault();
         const gameId = $("#gameIdForModal").val();
         const player1hand = $("#player1handConfirm").val();
         const player1pass = $("#passPhraseConfirm").val();
         const instance = await App.contracts.Janken.deployed();

         const hostPlayerHand = await instance.getPlayer1hand(gameId);
         let guestPlayerHand = await instance.getPlayer2hand(gameId);
         guestPlayerHand = parseInt(guestPlayerHand.toString());
         console.log(parseInt(guestPlayerHand.toString()));

         console.log(gameId);
         console.log(player1hand);
         console.log(player1pass);
         if(hostPlayerHand && guestPlayerHand){
             instance.judge(gameId, player1hand, player1pass);
         }
     });
 },

 eventWatch: async function(){
     const instance = await App.contracts.Janken.deployed();
     let account
     web3.eth.getAccounts(async (err, accounts) => {
         account = accounts[0];

         // For host player
         const create = await instance.gameCreated({player1: account},{fromBlock: 0, toBlock: 'latest'});
         const player2joinedAsHostPlayer = await instance.player2joined({player1: account}, {fromBlock: 0, toBlock: 'latest'});
         const player1submitHandAsHostPlayer = await instance.player1submitHand({player1: account}, {fromBlock: 0, toBlock: 'latest'});
         const player2submitHandAsHostPlayer = await instance.player2submitHand({player1: account}, {fromBlock: 0, toBlock: 'latest'});


         let gameArray = [];
         create.watch(async (err, log) => {
             const gameId = log.args.gameId;
             const gameCompleted = await instance.checkIfGameCompleted(gameId);
             if(!gameCompleted && !gameArray.includes(gameId+"create")){
                 $("#gameTable").append("<tr id='" + gameId + "'><td>" + log.args.gameId + "</td><td>◯</td></tr>");
                 gameArray.push(gameId+"create");
             }
        })

        player2joinedAsHostPlayer.watch(async (err, log) => {
            const gameId = log.args.gameId;
            const gameCompleted = await instance.checkIfGameCompleted(gameId);
            if(!gameCompleted && !gameArray.includes(gameId+"player2joinedAsHostPlayer")){
                $("#" + gameId).append("<td>◯</td>")
                gameArray.push(gameId+"player2joinedAsHostPlayer");
            }
        });

        player1submitHandAsHostPlayer.watch(async (err, log) => {
            const gameId = log.args.gameId;
            const gameCompleted = await instance.checkIfGameCompleted(gameId);
            if(!gameCompleted && !gameArray.includes(gameId+"player1submitHandAsHostPlayer")){
                $("#" + gameId).append("<td>◯</td>");
                gameArray.push(gameId+"player1submitHandAsHostPlayer");
            }
        });

        player2submitHandAsHostPlayer.watch(async (err, log) => {
            const gameId = log.args.gameId;
            const gameCompleted = await instance.checkIfGameCompleted(gameId);
            if(!gameCompleted && !gameArray.includes(gameId+"player2submitHandAsHostPlayer")){
                $("#" + gameId).append("<td>◯</td>");
                gameArray.push(gameId+"player2submitHandAsHostPlayer");
            }
        });


        // For guest player
        const player2joinedAsGuestPlayer = await instance.player2joined({player2: account}, {fromBlock: 0, toBlock: 'latest'});
        const player1submitHandAsGuestPlayer = await instance.player1submitHand({player2: account}, {fromBlock: 0, toBlock: 'latest'});
        const player2submitHandAsGuestPlayer = await instance.player2submitHand({player2: account}, {fromBlock: 0, toBlock: 'latest'});


       player2joinedAsGuestPlayer.watch(async (err, log) => {
           const gameId = log.args.gameId;
           const gameCompleted = await instance.checkIfGameCompleted(gameId);
           if(!gameCompleted && !gameArray.includes(gameId+"player2joinedAsGuestPlayer")){
                $("#gameTable").append("<tr id='" + gameId + "'><td>" + log.args.gameId + "</td><td>×</td><td>◯</td></tr>");
                gameArray.push(gameId+"player2joinedAsGuestPlayer");
           }
       });

       player1submitHandAsGuestPlayer.watch(async (err, log) => {
           const gameId = log.args.gameId;
           const gameCompleted = await instance.checkIfGameCompleted(gameId);
           if(!gameCompleted && !gameArray.includes(gameId+"player1submitHandAsGuestPlayer")){
               $("#" + gameId).append("<td>◯</td>");
               gameArray.push(gameId+"player1submitHandAsGuestPlayer");
           }
       });

       player2submitHandAsGuestPlayer.watch(async (err, log) => {
           const gameId = log.args.gameId;
           const gameCompleted = await instance.checkIfGameCompleted(gameId);
           if(!gameCompleted && !gameArray.includes(gameId+"player2submitHandAsGuestPlayer")){
               $("#" + gameId).append("<td>◯</td>");
               gameArray.push(gameId+"player2submitHandAsGuestPlayer");
           }
       });

     })
 }



}

$(function() {
  $(window).load(function() {
    App.init();
    $("#getLetter").hide();
  });
});
