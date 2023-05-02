<div>
    <div class="button">
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <p on:click>
            <slot></slot>
        </p>
    </div>
</div>

<style>
    .button{
        position:relative;
        display:inline-block;
        margin:20px 0 10px 0;
        cursor: pointer;
    }

    .button p{
        color:white;
        font-family:Helvetica, sans-serif;
        font-weight:bold;
        font-size:36px;
        text-align: center;
        text-decoration:none;
        background-color:#E32636;
        display:block;
        position:relative;
        padding:20px 40px;
        
        -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
        text-shadow: 0px 1px 0px #000;
        
        -webkit-box-shadow: inset 0 1px 0 #ff7aa2, 0 10px 0 #6e0819;
        -moz-box-shadow: inset 0 1px 0 #ff7aa2, 0 10px 0 #6e0819;
        box-shadow: inset 0 1px 0 #ff7aa2, 0 10px 0 #6e0819;
        
        -webkit-border-radius: 5px;
        -moz-border-radius: 5px;
        border-radius: 5px;
    }

    .button p:active{
        top:10px;
        background-color:#E32636;
        
        -webkit-box-shadow:inset 0 1px 0 #ff7aa2, inset 0 -3px 0 #6e0819;
        -moz-box-shadow:inset 0 1px 0 #ff7aa2, inset 0 -3pxpx 0 #6e0819;
        box-shadow:inset 0 1px 0 #ff7aa2, inset 0 -3px 0 #6e0819;
    }

    .button:after{
        content:"";
        height:100%;
        width:100%;
        padding:4px;
        position: absolute;
        bottom:-15px;
        left:-4px;
        z-index:-1;
        background-color:#2B1800;
        -webkit-border-radius: 5px;
        -moz-border-radius: 5px;
        border-radius: 5px;
    }
</style>